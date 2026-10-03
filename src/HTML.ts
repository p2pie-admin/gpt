export const HTML = `<!DOCTYPE html>
<html>
  <head>
  <meta charset="UTF-8" />
    <title>GPT APP</title>
    <link rel="icon" href="./favicon.ico" type="image/x-icon" />
    <style>
      body { 
        font-family: sans-serif; 
        padding: 20px; 
        background: #333;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      h2 {
        color: #fff;
        margin-bottom: 20px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
        max-width: 1080px;
        width: 100%;
      }
      @media (max-width: 900px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      .action {
        border: 1px solid #1e2d6b;
        border-radius: 10px;
        padding: 10px;
        background: #222;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      button, input {
        font-size: 16px;
        margin: 5px 0;
        padding: 8px 16px;
        color: rgba(147, 151, 208, 1);
        border: 1px solid rgb(30, 45, 107);
        border-radius: 14px;
        background: #1a1e2cff;
        cursor: pointer;
      }
      button:hover {
        background: #171f3aff;
      }
      .desc {
        font-size: 20px;
        color: #ddd;
        margin-top: 8px;
      }
      .wide-input {
        width: 100%;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <h2>Run Scripts</h2>

    <div class="grid" id="actionsBox"></div>

    <script>
      const actions = [
        { slug: "parsebest", description: "Пробегает по bestchange.com/list.html и вытаскивает ссылки на обменники формата bestchange.com/id, но ничего не изменяет в базе, просто ищет и сохраняет локально в bc-scraped.json." },
        { slug: "fillreal", description: "Берет спаршенные обменники из bc-scraped.json и медленно переходит на все ссылки беста через иммитацию браузера, чтобы бест не блочил. Тем самым из ссылок bestchange.com/id  получаем настоящие ссылки на обменники типа 1-coin.online. " },
        { slug: "findxml", description: "Берет ссылки xml уже рабочих обменников из базы. Смотрит самые популярные окончания этих ссылок у разный скриптов сайтов обменников. Например: .../xml-rates.json. Далее идет по спаршенным с беста обменникам и пытается подобрать xml ссылку через всевозможные комбинации окончаний ссылок. Если ссылка отдает xml курсов - сохраняем." },
        { slug: "create", description: "Берет файл bc-xml.json Смотрит спаршенные с беста ссылки + xml ссылки и сопоставляет с тем, что уже есть в базе данных. Если такой обменник существует - пропускаем. Если нет - заводим его в базу продакшена." },
        { slug: "health", description: "Берет все xml ссылки и ссылки сайта  обменников  с продакшн базы и проверяет их на работоспособность." },
        { slug: "descriptions_auto", description: "Предварительный шаг заполнения описания обменников. Делает это без участия человека там, где пускает флара. Где не пускает - используется следующий шаг." },
        { slug: "load_html", description: "Ручной способ для тех обменников, которым не получилось заполнить описание автоматически. Пробегается по всем ссылкам на сайты обменников. Пытается запустить ссылки на настоящем хром браузере (не эмуляторе). Открывает 50 вкладок с обменниками за раз. Дает время порешать капчу, вручную убрать шлак. По готовности вытаскивает html каждого сайта и загружает новую партию вкладок." },
        { slug: "descriptions_file", description: "Берет HTML обменников и пытается из домена сгенерить имя обменника. Затем среди кучи HTML шлака ищет блоки с крупным текстом. Скармливает эти блоки нейронке для генерации описания обменника на двух языках, заполняет время работы, контакты, генерит рандомный первичный рейтинг. Добавляет эти данные соответствующим обменникам в продакшн базе." },
        { slug: "fill_dirs", description: "Берет все существующие пары направлений и генерирует им уникальные тексты. Промпт выбирается рандомно из 5 вариантов." },
        { slug: "fill_dirs_cities", description: "Генерирует тексты направлений для всех городов на основе non_empty_cities, добавляя город к ключу и используя отдельную модель CITY_MODEL." },
        { slug: "fill_cities", description: "Создает отдельные городские тексты (без направлений) с ключом city_slug, используя только модель CITY_MODEL и промпты city_1..3." },
        { slug: "default_dirs", description: "Заполняет дефолтные тексты направлений для всех сочетаний секций crypto/cash/bank итд. Эта заглушка нужна в случае, если не заполнен уникальный текст для конкретного направления. Например направление BTC -> CASHRUB будет иметь уникальный текст. Но богом забытое или новое направление будет иметь уникальный лишь заголовок, а описание будет одинаковое для всех принадлежащих направлений crypto -> cash, crypto -> bank, crypto -> crypto, bank -> crypto итд. Всего их 25 заглушек. Для генерации каждой заглушки выбирается рандомно один промпт из 3 вариантов." },
        { slug: "default_mass_dirs", description: "Заполняет дефолтные тексты массовых направлений секций на валюту" },
        { slug: "table_formatter", description: "Форматирует Excel таблицу yadro.xlsx в JSON и сохраняет файл рядом с таблицей." },
        { slug: "change_exchanger_names", description: "Меняет имена обменников под нужный формат с заглавными буквами, дефисами итд" },
        { slug: "mergeSame", description: "Ищет обменники с одинаковыми ref_link/rates_link, ждет 2 секунды на каждом совпадении, удаляет доноров и создает новый draft2 с объединенными данными." },
        { slug: "create_offices", description: "Создает офисы из some_data/kirill_offices.ts, ищет город по cityCode и сопоставляет с существующими обменниками." },
        { slug: "maps_business", description: "Ищет локальные бизнесы вокруг координат из .env через Foursquare, вытаскивает контакты/сайты и фильтрует через GPT по потребности в сайте/автоматизации." },
        { slug: "maps_business_outreach", description: "Берет maps-business.json, генерирует персональные outreach-сообщения через GPT-4 и сохраняет в business_result.json." }
      ];

      const base = "";
      const container = document.getElementById("actionsBox");

      function run(route) {
        fetch(\`\${base}/\${route}\`)
          .then(res => res.text())
          .catch(err => alert("Error: " + err));
      }

      function runSection() {
        const val = document.getElementById("sectionInput").value;
        if (!val) return alert("Enter section name");
        fetch(\`/section=\${encodeURIComponent(val)}\`)
          .then(res => res.text())
          .then(() => alert("Success"))
          .catch(err => alert("Error: " + err));
      }

      function runDomainFinder() {
        fetch("/domain_finder")
          .then(res => res.json())
          .then(data => {
            const foundNow = (data.availableNow || []).map(item => item.domain).join(", ");
            const foundTotal = (data.availableTotal || []).map(item => item.domain).join(", ");

            if (data.processedNow === 0 && data.remaining === 0) {
              alert(\`All variants already checked. Checked total: \${data.checkedTotal}.\\nAvailable total: \${(data.availableTotal || []).length}\${foundTotal ? "\\n" + foundTotal : ""}\`);
              return;
            }

            alert(\`Done. Processed: \${data.processedNow}, remaining: \${data.remaining}\${foundNow ? "\\nAvailable now: " + foundNow : ""}\`);
          })
          .catch(err => alert("Error: " + err));
      }

      function runDomainTop100() {
        fetch("/domain_top100")
          .then(res => res.json())
          .then(data => {
            alert(\`Done. Source: \${data.sourceCount}, result: \${data.resultCount}. Check server console for final list.\`);
          })
          .catch(err => alert("Error: " + err));
      }

      function appendCustomCards() {
        const sectionDiv = document.createElement("div");
        sectionDiv.className = "action";
        sectionDiv.innerHTML = \`
          <input id="sectionInput" class="wide-input" placeholder="Enter section name" />
          <button onclick="runSection()">Fill Articles (section)</button>
          <div class="desc">Заполнить артиклы платежек для заданной секции</div>
        \`;
        container.appendChild(sectionDiv);

        const finderDiv = document.createElement("div");
        finderDiv.className = "action";
        finderDiv.innerHTML = \`
          <button onclick="runDomainFinder()">domain_finder</button>
          <div class="desc">Проверяет короткие .com из файла по WHOIS, сохраняет прогресс и пропускает уже проверенные варианты.</div>
        \`;
        container.appendChild(finderDiv);

        const topDiv = document.createElement("div");
        topDiv.className = "action";
        topDiv.innerHTML = \`
          <button onclick="runDomainTop100()">domain_top100</button>
          <div class="desc">Берет available-домены из domain_checks.json, прогоняет отбор батчами по 20 через GPT mini и выводит итоговый top в серверную консоль.</div>
        \`;
        container.appendChild(topDiv);
      }

      appendCustomCards();

      // render all actions
      actions.forEach(({ slug, description }) => {
        const actionDiv = document.createElement("div");
        actionDiv.className = "action";

        const btn = document.createElement("button");
        btn.textContent = slug;
        btn.onclick = () => run(slug);

        const desc = document.createElement("div");
        desc.className = "desc";
        desc.textContent = description;

        actionDiv.appendChild(btn);
        actionDiv.appendChild(desc);
        container.appendChild(actionDiv);
      });
    </script>
  </body>
</html>`;

const exchangers = [
  {
    exchanger: "yzex.co",
    status: "Активен",
    course_count: 27,
    parsing_duration: 0.5168,
    xml_link: "https://yzex.co/request-exportxml.xml",
    xml_size_kb: 8.31,
    frontend_name_ru: "Yzex",
    chpu_url: "yzex-co",
    link_best: "https://www.bestchange.ru/yzex-exchanger.html",
    link_kurs: "https://kurs.expert/ru/obmennik/yzex-co/feedbacks.html",
    link_sumo: "https://exchangesumo.com/exchanger/1380/Yzex/",
    email_front: "info@yzex.co",
    telegram_front: "yzexco",
    telephone_front: "",
    exchanger_creation_date: "2025-03-01",
  },
  // ...
];

let realLink = (xml) =>
  "https://" + xml.replace("https://", "").replace("api.", "").split("/")[0];

const res = exchangers.map((e) => ({
  name: e.chpu_url,
  link_best: e.link_best,
  link_kurs: e.link_kurs,
  link_sumo: e.link_sumo,
  real_link: realLink(e.xml_link),
  display_name: e.frontend_name_ru,
  email: e.email_front,
  phone_number: e.telephone_front,
  telegram: e.telegram_front,
  xml: e.xml_link,
}));
console.log(res);

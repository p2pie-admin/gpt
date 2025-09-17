import { gql } from "graphql-request";

export const AuthMutation = gql`
  mutation login {
    login(
      input: {
        identifier: "gpt"
        password: "SUJ#vq2x#@TH4L-"
        provider: "local"
      }
    ) {
      jwt
      user {
        username
        email
      }
    }
  }
`;

export const PromptsQuery = gql`
  {
    prompts(pagination: { limit: 2000 }) {
      data {
        id
        attributes {
          code
          description
        }
      }
    }
  }
`;

export const CreateArticle = gql`
  mutation CreateArticle(
    $header: String
    $subheader: String
    $code: String
    $chapters: JSON
    $stats: JSON
    $locale: I18NLocaleCode
  ) {
    createArticle(
      data: {
        header: $header
        subheader: $subheader
        code: $code
        stats: $stats
        chapters: $chapters
      }
      locale: $locale
    ) {
      data {
        id
      }
    }
  }
`;

export const CreateArticleLocalization = gql`
  mutation CreateArticleLocalization(
    $id: ID!
    $locale: I18NLocaleCode!
    $data: ArticleInput!
  ) {
    createArticleLocalization(id: $id, locale: $locale, data: $data) {
      data {
        id
      }
    }
  }
`;

export const PmGroupsQuery = gql`
  {
    selector {
      data {
        attributes {
          sections {
            en_title
            ru_title
            pm_groups(pagination: { start: 0, limit: 1000 }) {
              data {
                attributes {
                  en_name
                  ru_name
                  prefix
                  options {
                    ... on ComponentSelectorSubgroup {
                      code
                      name
                      alternative_codes
                    }
                    ... on ComponentSelectorCurrency {
                      currency {
                        data {
                          attributes {
                            code
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const LinksQuery = gql`
  {
    exchangers(
      pagination: { limit: 2000 } # filters: { ru_description: { notNull: false } }
    ) {
      data {
        id
        attributes {
          name
          rates_link
          ref_link
        }
      }
    }
  }
`;

export const DescriptionQuery = gql`
  {
    exchangers(
      pagination: { limit: 1000 }
      filters: { exchanger_card: { ru_description: { notNull: false } } }
    ) {
      data {
        id
        attributes {
          name
          rates_link
          ref_link
        }
      }
    }
  }
`;

export const UpdateRefLinks = gql`
  mutation UpdateExchanger($id: ID!, $ref_link: String) {
    updateExchanger(id: $id, data: { ref_link: $ref_link }) {
      data {
        id
      }
    }
  }
`;

export const UpdateExchangerName = gql`
  mutation UpdateExchanger($id: ID!, $name: String) {
    updateExchanger(id: $id, data: { name: $name }) {
      data {
        id
      }
    }
  }
`;

export const DeleteExchanger = gql`
  mutation DeleteExchanger($id: ID!) {
    deleteExchanger(id: $id) {
      data {
        id
      }
    }
  }
`;

export const UpdateDescriptions = gql`
  mutation UpdateExchanger(
    $id: ID!
    $ru_description: String
    $en_description: String
    $telegram: String
    $email: String
    $working_time: String
    $admin_rating: Float
  ) {
    updateExchanger(
      id: $id
      data: {
        admin_rating: $admin_rating
        exchanger_card: {
          en_description: $en_description
          ru_description: $ru_description
          telegram: $telegram
          email: $email
          working_time: $working_time
        }
      }
    ) {
      data {
        id
      }
    }
  }
`;

export const CreateExchangerBC = gql`
  mutation createExchangerBC(
    $name: String
    $status: ENUM_EXCHANGER_STATUS
    $rates_link: String
    $ref_link: String
    $admin_rating: Float
    $bc_card_link: String
  ) {
    createExchanger(
      data: {
        name: $name
        status: $status
        rates_link: $rates_link
        ref_link: $ref_link
        admin_rating: $admin_rating
        exchanger_card: { bc_card_link: $bc_card_link }
      }
    ) {
      data {
        id
      }
    }
  }
`;

const pmGroup = gql`
    data {
      id
      attributes {
        en_name
        ru_name
        countries
        prefix
        options {
          ... on ComponentSelectorSubgroup {
            id
            name
            code
            currency {
              data {
                id
                attributes {
                  code
                  accuracy
                }
              }
            }
          }
          ... on ComponentSelectorCurrency {
            id
            currency {
              data {
                id
                attributes {
                  code
                  accuracy
                }
              }
            }
          }
        }
        color

        icon {
          data {
            id
            attributes {
              alternativeText
              url
            }
          }
        }
      }
    }
  
`;

export const selectorQuery = gql`
   query Selector {
    selector {
      data {
        id
        attributes {
          en_give_header
          ru_give_header
          en_get_header
          ru_get_header
          search_bar {
            ru_placeholder
            en_placeholder
            ru_give_adornment
            en_give_adornment
            ru_get_adornment
            en_get_adornment
          }
          sections {
            id
            rows
            columns
            ru_title
            en_title
            pm_groups(pagination: { start: 0, limit: 1000 } ) {
              ${pmGroup}
          }
        }
      }
    }
  }
   }
`;

export const CreateTextBoxMutation = gql`
  mutation CreateTextBox(
    $key: String
    $text: String
    $header: String
    $subheader: String
    $seo_description: String
    $seo_title: String
  ) {
    createTextBox(
      locale: "en"
      data: {
        text: $text
        key: $key
        subheader: $subheader
        header: $header
        seo_title: $seo_title
        seo_description: $seo_description
      }
    ) {
      data {
        id
      }
    }
  }
`;

export const CreateTextBoxLocalizationMutation = gql`
  mutation CreateTextBoxLocalization(
    $baseId: ID!
    $text: String
    $header: String
    $subheader: String
    $seo_description: String
    $seo_title: String
  ) {
    createTextBoxLocalization(
      id: $baseId
      locale: "ru"
      data: {
        text: $text
        header: $header
        subheader: $subheader
        seo_description: $seo_description
        seo_title: $seo_title
      }
    ) {
      data {
        id
      }
    }
  }
`;

export const CreateDirsText = gql`
  mutation CreateDirsText(
    $locale: I18NLocaleCode
    $section_give: ENUM_DIRSTEXT_SECTION_GIVE
    $section_get: ENUM_DIRSTEXT_SECTION_GET
    $text: String
    $header: String
    $subheader: String
    $seo_description: String
    $seo_title: String
  ) {
    createDirsText(
      locale: $locale
      data: {
        section_give: $section_give
        section_get: $section_get
        text: $text
        header: $header
        subheader: $subheader
        seo_description: $seo_description
        seo_title: $seo_title
      }
    ) {
      data {
        id
      }
    }
  }
`;

export const CreateDirsTextLocalization = gql`
  mutation CreateDirsTextLocalization(
    $id: ID!
    $locale: I18NLocaleCode
    $data: DirsTextInput!
  ) {
    createDirsTextLocalization(id: $id, locale: $locale, data: $data) {
      data {
        id
      }
    }
  }
`;

export const RuTextBoxKeysQuery = gql`
  {
    textBoxes(locale: "ru", pagination: { limit: 50000 }) {
      data {
        id
        attributes {
          key
        }
      }
    }
  }
`;

export const EnTextBoxKeysQuery = gql`
  {
    textBoxes(locale: "en", pagination: { limit: 50000 }) {
      data {
        id
        attributes {
          key
        }
      }
    }
  }
`;

export const articleCodesQuery = gql`
  query Articles($locale: I18NLocaleCode) {
    articles(locale: $locale, pagination: { start: 0, limit: 1000 }) {
      data {
        attributes {
          code
        }
      }
    }
  }
`;

export const CreateMassDirsText = gql`
  mutation CreateMassDirsText(
    $code: String
    $locale: I18NLocaleCode
    $currency: ID
    $isSell: Boolean
    $text: String
    $header: String
    $subheader: String
    $seo_description: String
    $seo_title: String
  ) {
    createMassDirsText(
      locale: $locale
      data: {
        code: $code
        currency: $currency
        isSell: $isSell
        text: $text
        header: $header
        subheader: $subheader
        seo_description: $seo_description
        seo_title: $seo_title
      }
    ) {
      data {
        id
      }
    }
  }
`;

export const CreateMassDirsTextLocalization = gql`
  mutation CreateMassDirsTextLocalization(
    $id: ID!
    $code: String
    $locale: I18NLocaleCode
    $currency: ID
    $isSell: Boolean
    $text: String
    $header: String
    $subheader: String
    $seo_description: String
    $seo_title: String
  ) {
    createMassDirsTextLocalization(
      id: $id
      locale: $locale
      data: {
        code: $code
        currency: $currency
        isSell: $isSell
        text: $text
        header: $header
        subheader: $subheader
        seo_description: $seo_description
        seo_title: $seo_title
      }
    ) {
      data {
        id
      }
    }
  }
`;

export const CurrencyIdsQuery = gql`
  {
    currencies(pagination: { start: 0, limit: 1000 }) {
      data {
        id
        attributes {
          code
        }
      }
    }
  }
`;

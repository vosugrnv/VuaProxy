/* Taxonomy proxy — Tất cả Proxy → 3 nhóm (Datacenter / Dân cư / Dân cư VN) + khu vực/quốc gia */
const PROXY_MEGA_REGIONS = {
  "chau-a": {
    slug: "chau-a",
    title: "Châu Á",
    icon: "asia",
    countries: [
            {
                  name: "Ả Rập Xê Út",
                  code: "sa",
                  q: "Saudi Arabia"
            },
            {
                  name: "Afghanistan",
                  code: "af",
                  q: "Afghanistan"
            },
            {
                  name: "Armenia",
                  code: "am",
                  q: "Armenia"
            },
            {
                  name: "Azerbaijan",
                  code: "az",
                  q: "Azerbaijan"
            },
            {
                  name: "Ấn Độ",
                  code: "in",
                  q: "India"
            },
            {
                  name: "Bahrain",
                  code: "bh",
                  q: "Bahrain"
            },
            {
                  name: "Bangladesh",
                  code: "bd",
                  q: "Bangladesh"
            },
            {
                  name: "Bhutan",
                  code: "bt",
                  q: "Bhutan"
            },
            {
                  name: "Brunei",
                  code: "bn",
                  q: "Brunei"
            },
            {
                  name: "Campuchia",
                  code: "kh",
                  q: "Cambodia"
            },
            {
                  name: "Đài Loan",
                  code: "tw",
                  q: "Taiwan"
            },
            {
                  name: "Georgia",
                  code: "ge",
                  q: "Georgia"
            },
            {
                  name: "Hàn Quốc",
                  code: "kr",
                  q: "South Korea"
            },
            {
                  name: "Hồng Kông",
                  code: "hk",
                  q: "Hong Kong"
            },
            {
                  name: "Indonesia",
                  code: "id",
                  q: "Indonesia"
            },
            {
                  name: "Iran",
                  code: "ir",
                  q: "Iran"
            },
            {
                  name: "Iraq",
                  code: "iq",
                  q: "Iraq"
            },
            {
                  name: "Israel",
                  code: "il",
                  q: "Israel"
            },
            {
                  name: "Jordan",
                  code: "jo",
                  q: "Jordan"
            },
            {
                  name: "Kazakhstan",
                  code: "kz",
                  q: "Kazakhstan"
            },
            {
                  name: "Kuwait",
                  code: "kw",
                  q: "Kuwait"
            },
            {
                  name: "Kyrgyzstan",
                  code: "kg",
                  q: "Kyrgyzstan"
            },
            {
                  name: "Lào",
                  code: "la",
                  q: "Laos"
            },
            {
                  name: "Lebanon",
                  code: "lb",
                  q: "Lebanon"
            },
            {
                  name: "Macao",
                  code: "mo",
                  q: "Macao"
            },
            {
                  name: "Malaysia",
                  code: "my",
                  q: "Malaysia"
            },
            {
                  name: "Maldives",
                  code: "mv",
                  q: "Maldives"
            },
            {
                  name: "Mông Cổ",
                  code: "mn",
                  q: "Mongolia"
            },
            {
                  name: "Myanmar",
                  code: "mm",
                  q: "Myanmar"
            },
            {
                  name: "Nepal",
                  code: "np",
                  q: "Nepal"
            },
            {
                  name: "Nhật Bản",
                  code: "jp",
                  q: "Japan"
            },
            {
                  name: "Oman",
                  code: "om",
                  q: "Oman"
            },
            {
                  name: "Pakistan",
                  code: "pk",
                  q: "Pakistan"
            },
            {
                  name: "Palestine",
                  code: "ps",
                  q: "Palestine"
            },
            {
                  name: "Philippines",
                  code: "ph",
                  q: "Philippines"
            },
            {
                  name: "Qatar",
                  code: "qa",
                  q: "Qatar"
            },
            {
                  name: "Singapore",
                  code: "sg",
                  q: "Singapore"
            },
            {
                  name: "Síp",
                  code: "cy",
                  q: "Cyprus"
            },
            {
                  name: "Sri Lanka",
                  code: "lk",
                  q: "Sri Lanka"
            },
            {
                  name: "Syria",
                  code: "sy",
                  q: "Syria"
            },
            {
                  name: "Tajikistan",
                  code: "tj",
                  q: "Tajikistan"
            },
            {
                  name: "Thái Lan",
                  code: "th",
                  q: "Thailand"
            },
            {
                  name: "Thổ Nhĩ Kỳ",
                  code: "tr",
                  q: "Turkey"
            },
            {
                  name: "Triều Tiên",
                  code: "kp",
                  q: "North Korea"
            },
            {
                  name: "Trung Quốc",
                  code: "cn",
                  q: "China"
            },
            {
                  name: "Turkmenistan",
                  code: "tm",
                  q: "Turkmenistan"
            },
            {
                  name: "UAE",
                  code: "ae",
                  q: "UAE"
            },
            {
                  name: "Uzbekistan",
                  code: "uz",
                  q: "Uzbekistan"
            },
            {
                  name: "Việt Nam",
                  code: "vn",
                  q: "Vietnam"
            },
            {
                  name: "Yemen",
                  code: "ye",
                  q: "Yemen"
            }
      ]
  },
  "chau-au": {
    slug: "chau-au",
    title: "Châu Âu",
    icon: "eu",
    countries: [
            {
                  name: "Albania",
                  code: "al",
                  q: "Albania"
            },
            {
                  name: "Andorra",
                  code: "ad",
                  q: "Andorra"
            },
            {
                  name: "Anh",
                  code: "gb",
                  q: "United Kingdom"
            },
            {
                  name: "Áo",
                  code: "at",
                  q: "Austria"
            },
            {
                  name: "Ba Lan",
                  code: "pl",
                  q: "Poland"
            },
            {
                  name: "Bắc Macedonia",
                  code: "mk",
                  q: "North Macedonia"
            },
            {
                  name: "Belarus",
                  code: "by",
                  q: "Belarus"
            },
            {
                  name: "Bỉ",
                  code: "be",
                  q: "Belgium"
            },
            {
                  name: "Bosnia",
                  code: "ba",
                  q: "Bosnia and Herzegovina"
            },
            {
                  name: "Bồ Đào Nha",
                  code: "pt",
                  q: "Portugal"
            },
            {
                  name: "Bulgaria",
                  code: "bg",
                  q: "Bulgaria"
            },
            {
                  name: "Croatia",
                  code: "hr",
                  q: "Croatia"
            },
            {
                  name: "Đan Mạch",
                  code: "dk",
                  q: "Denmark"
            },
            {
                  name: "Đức",
                  code: "de",
                  q: "Germany"
            },
            {
                  name: "Estonia",
                  code: "ee",
                  q: "Estonia"
            },
            {
                  name: "Gibraltar",
                  code: "gi",
                  q: "Gibraltar"
            },
            {
                  name: "Hà Lan",
                  code: "nl",
                  q: "Netherlands"
            },
            {
                  name: "Hungary",
                  code: "hu",
                  q: "Hungary"
            },
            {
                  name: "Hy Lạp",
                  code: "gr",
                  q: "Greece"
            },
            {
                  name: "Iceland",
                  code: "is",
                  q: "Iceland"
            },
            {
                  name: "Ireland",
                  code: "ie",
                  q: "Ireland"
            },
            {
                  name: "Isle of Man",
                  code: "im",
                  q: "Isle of Man"
            },
            {
                  name: "Kosovo",
                  code: "xk",
                  q: "Kosovo"
            },
            {
                  name: "Latvia",
                  code: "lv",
                  q: "Latvia"
            },
            {
                  name: "Liechtenstein",
                  code: "li",
                  q: "Liechtenstein"
            },
            {
                  name: "Lithuania",
                  code: "lt",
                  q: "Lithuania"
            },
            {
                  name: "Luxembourg",
                  code: "lu",
                  q: "Luxembourg"
            },
            {
                  name: "Malta",
                  code: "mt",
                  q: "Malta"
            },
            {
                  name: "Moldova",
                  code: "md",
                  q: "Moldova"
            },
            {
                  name: "Monaco",
                  code: "mc",
                  q: "Monaco"
            },
            {
                  name: "Montenegro",
                  code: "me",
                  q: "Montenegro"
            },
            {
                  name: "Na Uy",
                  code: "no",
                  q: "Norway"
            },
            {
                  name: "Nga",
                  code: "ru",
                  q: "Russia"
            },
            {
                  name: "Pháp",
                  code: "fr",
                  q: "France"
            },
            {
                  name: "Phần Lan",
                  code: "fi",
                  q: "Finland"
            },
            {
                  name: "Romania",
                  code: "ro",
                  q: "Romania"
            },
            {
                  name: "San Marino",
                  code: "sm",
                  q: "San Marino"
            },
            {
                  name: "Séc",
                  code: "cz",
                  q: "Czech Republic"
            },
            {
                  name: "Serbia",
                  code: "rs",
                  q: "Serbia"
            },
            {
                  name: "Slovakia",
                  code: "sk",
                  q: "Slovakia"
            },
            {
                  name: "Slovenia",
                  code: "si",
                  q: "Slovenia"
            },
            {
                  name: "Tây Ban Nha",
                  code: "es",
                  q: "Spain"
            },
            {
                  name: "Thụy Điển",
                  code: "se",
                  q: "Sweden"
            },
            {
                  name: "Thụy Sĩ",
                  code: "ch",
                  q: "Switzerland"
            },
            {
                  name: "Ukraine",
                  code: "ua",
                  q: "Ukraine"
            },
            {
                  name: "Vatican",
                  code: "va",
                  q: "Vatican City"
            },
            {
                  name: "Ý",
                  code: "it",
                  q: "Italy"
            }
      ]
  },
  "chau-my": {
    slug: "chau-my",
    title: "Châu Mỹ",
    icon: "am",
    countries: [
            {
                  name: "Antigua",
                  code: "ag",
                  q: "Antigua and Barbuda"
            },
            {
                  name: "Argentina",
                  code: "ar",
                  q: "Argentina"
            },
            {
                  name: "Bahamas",
                  code: "bs",
                  q: "Bahamas"
            },
            {
                  name: "Barbados",
                  code: "bb",
                  q: "Barbados"
            },
            {
                  name: "Belize",
                  code: "bz",
                  q: "Belize"
            },
            {
                  name: "Bolivia",
                  code: "bo",
                  q: "Bolivia"
            },
            {
                  name: "Brazil",
                  code: "br",
                  q: "Brazil"
            },
            {
                  name: "Canada",
                  code: "ca",
                  q: "Canada"
            },
            {
                  name: "Chile",
                  code: "cl",
                  q: "Chile"
            },
            {
                  name: "Colombia",
                  code: "co",
                  q: "Colombia"
            },
            {
                  name: "Costa Rica",
                  code: "cr",
                  q: "Costa Rica"
            },
            {
                  name: "Cuba",
                  code: "cu",
                  q: "Cuba"
            },
            {
                  name: "Dominica",
                  code: "dm",
                  q: "Dominica"
            },
            {
                  name: "Dominica (CH)",
                  code: "do",
                  q: "Dominican Republic"
            },
            {
                  name: "Ecuador",
                  code: "ec",
                  q: "Ecuador"
            },
            {
                  name: "El Salvador",
                  code: "sv",
                  q: "El Salvador"
            },
            {
                  name: "Grenada",
                  code: "gd",
                  q: "Grenada"
            },
            {
                  name: "Guatemala",
                  code: "gt",
                  q: "Guatemala"
            },
            {
                  name: "Guyana",
                  code: "gy",
                  q: "Guyana"
            },
            {
                  name: "Haiti",
                  code: "ht",
                  q: "Haiti"
            },
            {
                  name: "Honduras",
                  code: "hn",
                  q: "Honduras"
            },
            {
                  name: "Jamaica",
                  code: "jm",
                  q: "Jamaica"
            },
            {
                  name: "Mexico",
                  code: "mx",
                  q: "Mexico"
            },
            {
                  name: "Mỹ",
                  code: "us",
                  q: "United States"
            },
            {
                  name: "Nicaragua",
                  code: "ni",
                  q: "Nicaragua"
            },
            {
                  name: "Panama",
                  code: "pa",
                  q: "Panama"
            },
            {
                  name: "Paraguay",
                  code: "py",
                  q: "Paraguay"
            },
            {
                  name: "Peru",
                  code: "pe",
                  q: "Peru"
            },
            {
                  name: "Puerto Rico",
                  code: "pr",
                  q: "Puerto Rico"
            },
            {
                  name: "Saint Kitts",
                  code: "kn",
                  q: "Saint Kitts and Nevis"
            },
            {
                  name: "Saint Lucia",
                  code: "lc",
                  q: "Saint Lucia"
            },
            {
                  name: "Saint Vincent",
                  code: "vc",
                  q: "Saint Vincent"
            },
            {
                  name: "Suriname",
                  code: "sr",
                  q: "Suriname"
            },
            {
                  name: "Trinidad",
                  code: "tt",
                  q: "Trinidad and Tobago"
            },
            {
                  name: "Uruguay",
                  code: "uy",
                  q: "Uruguay"
            },
            {
                  name: "Venezuela",
                  code: "ve",
                  q: "Venezuela"
            }
      ]
  },
  "chau-phi": {
    slug: "chau-phi",
    title: "Châu Phi",
    icon: "af",
    countries: [
            {
                  name: "Ai Cập",
                  code: "eg",
                  q: "Egypt"
            },
            {
                  name: "Algeria",
                  code: "dz",
                  q: "Algeria"
            },
            {
                  name: "Angola",
                  code: "ao",
                  q: "Angola"
            },
            {
                  name: "Benin",
                  code: "bj",
                  q: "Benin"
            },
            {
                  name: "Botswana",
                  code: "bw",
                  q: "Botswana"
            },
            {
                  name: "Bờ Biển Ngà",
                  code: "ci",
                  q: "Côte d'Ivoire"
            },
            {
                  name: "Burkina Faso",
                  code: "bf",
                  q: "Burkina Faso"
            },
            {
                  name: "Burundi",
                  code: "bi",
                  q: "Burundi"
            },
            {
                  name: "Cameroon",
                  code: "cm",
                  q: "Cameroon"
            },
            {
                  name: "Cape Verde",
                  code: "cv",
                  q: "Cape Verde"
            },
            {
                  name: "CAR",
                  code: "cf",
                  q: "Central African Republic"
            },
            {
                  name: "Chad",
                  code: "td",
                  q: "Chad"
            },
            {
                  name: "Comoros",
                  code: "km",
                  q: "Comoros"
            },
            {
                  name: "Congo",
                  code: "cg",
                  q: "Congo"
            },
            {
                  name: "Congo (DRC)",
                  code: "cd",
                  q: "DR Congo"
            },
            {
                  name: "Djibouti",
                  code: "dj",
                  q: "Djibouti"
            },
            {
                  name: "Equatorial Guinea",
                  code: "gq",
                  q: "Equatorial Guinea"
            },
            {
                  name: "Eritrea",
                  code: "er",
                  q: "Eritrea"
            },
            {
                  name: "Eswatini",
                  code: "sz",
                  q: "Eswatini"
            },
            {
                  name: "Ethiopia",
                  code: "et",
                  q: "Ethiopia"
            },
            {
                  name: "Gabon",
                  code: "ga",
                  q: "Gabon"
            },
            {
                  name: "Gambia",
                  code: "gm",
                  q: "Gambia"
            },
            {
                  name: "Ghana",
                  code: "gh",
                  q: "Ghana"
            },
            {
                  name: "Guinea",
                  code: "gn",
                  q: "Guinea"
            },
            {
                  name: "Guinea-Bissau",
                  code: "gw",
                  q: "Guinea-Bissau"
            },
            {
                  name: "Kenya",
                  code: "ke",
                  q: "Kenya"
            },
            {
                  name: "Lesotho",
                  code: "ls",
                  q: "Lesotho"
            },
            {
                  name: "Liberia",
                  code: "lr",
                  q: "Liberia"
            },
            {
                  name: "Libya",
                  code: "ly",
                  q: "Libya"
            },
            {
                  name: "Madagascar",
                  code: "mg",
                  q: "Madagascar"
            },
            {
                  name: "Malawi",
                  code: "mw",
                  q: "Malawi"
            },
            {
                  name: "Mali",
                  code: "ml",
                  q: "Mali"
            },
            {
                  name: "Mauritania",
                  code: "mr",
                  q: "Mauritania"
            },
            {
                  name: "Mauritius",
                  code: "mu",
                  q: "Mauritius"
            },
            {
                  name: "Morocco",
                  code: "ma",
                  q: "Morocco"
            },
            {
                  name: "Mozambique",
                  code: "mz",
                  q: "Mozambique"
            },
            {
                  name: "Nam Phi",
                  code: "za",
                  q: "South Africa"
            },
            {
                  name: "Nam Sudan",
                  code: "ss",
                  q: "South Sudan"
            },
            {
                  name: "Namibia",
                  code: "na",
                  q: "Namibia"
            },
            {
                  name: "Niger",
                  code: "ne",
                  q: "Niger"
            },
            {
                  name: "Nigeria",
                  code: "ng",
                  q: "Nigeria"
            },
            {
                  name: "Rwanda",
                  code: "rw",
                  q: "Rwanda"
            },
            {
                  name: "Senegal",
                  code: "sn",
                  q: "Senegal"
            },
            {
                  name: "Seychelles",
                  code: "sc",
                  q: "Seychelles"
            },
            {
                  name: "Sierra Leone",
                  code: "sl",
                  q: "Sierra Leone"
            },
            {
                  name: "Somalia",
                  code: "so",
                  q: "Somalia"
            },
            {
                  name: "Sudan",
                  code: "sd",
                  q: "Sudan"
            },
            {
                  name: "Tanzania",
                  code: "tz",
                  q: "Tanzania"
            },
            {
                  name: "Togo",
                  code: "tg",
                  q: "Togo"
            },
            {
                  name: "Tunisia",
                  code: "tn",
                  q: "Tunisia"
            },
            {
                  name: "Uganda",
                  code: "ug",
                  q: "Uganda"
            },
            {
                  name: "Zambia",
                  code: "zm",
                  q: "Zambia"
            },
            {
                  name: "Zimbabwe",
                  code: "zw",
                  q: "Zimbabwe"
            }
      ]
  },
  "chau-dai-duong": {
    slug: "chau-dai-duong",
    title: "Châu Đại Dương",
    icon: "oc",
    countries: [
            {
                  name: "Fiji",
                  code: "fj",
                  q: "Fiji"
            },
            {
                  name: "New Zealand",
                  code: "nz",
                  q: "New Zealand"
            },
            {
                  name: "Papua New Guinea",
                  code: "pg",
                  q: "Papua New Guinea"
            },
            {
                  name: "Úc",
                  code: "au",
                  q: "Australia"
            }
      ]
  },
  "proxy-mmo": {
    slug: "proxy-mmo",
    title: "Proxy làm MMO",
    icon: "mmo",
    countries: [
      { name: "Facebook Ads", code: "us", q: "Facebook" },
      { name: "Google Ads", code: "us", q: "Google" },
      { name: "TikTok Ads", code: "us", q: "TikTok" },
      { name: "Shopee / Lazada", code: "vn", q: "Shopee" },
      { name: "Amazon", code: "us", q: "Amazon" },
      { name: "Tool antidetect", code: "us", q: "antidetect" }
    ]
  }
};

const PROXY_VN_CITIES = [
  { name: "Toàn quốc", code: "vn", q: "Vietnam" },
  { name: "Hà Nội", code: "vn", q: "Hà Nội" },
  { name: "TP. Hồ Chí Minh", code: "vn", q: "Hồ Chí Minh" },
  { name: "Đà Nẵng", code: "vn", q: "Đà Nẵng" },
  { name: "Hải Phòng", code: "vn", q: "Hải Phòng" },
  { name: "Cần Thơ", code: "vn", q: "Cần Thơ" },
  { name: "Bình Dương", code: "vn", q: "Bình Dương" },
  { name: "Đồng Nai", code: "vn", q: "Đồng Nai" }
];

const CATEGORY_TAXONOMY = {
  version: 5,
  parents: [
    {
      slug: "proxy",
      title: "Tất cả Proxy",
      seoTitle: "Tất cả Proxy — Datacenter, Dân cư & Proxy VN",
      note: "Proxy Datacenter, Proxy Dân cư đa quốc gia và Proxy dân cư Việt Nam",
      children: [
        { title: "Proxy Datacenter", slug: "proxy-datacenter" },
        { title: "Proxy Dân cư", slug: "proxy-dan-cu" },
        { title: "Proxy dân cư Việt Nam", slug: "proxy-dan-cu-viet-nam" },
        { title: "Luna proxy", slug: "luna-proxy" },
        { title: "9Proxy", slug: "9proxy" }
      ]
    }
  ],
  mega: [
    {
      slug: "proxy-datacenter",
      title: "Proxy Datacenter",
      panelTitle: "PROXIES DATACENTER IPV4 PRIVATE",
      href: "/tat-ca-khu-vuc",
      regionKeys: ["chau-a", "chau-au", "chau-my", "chau-phi", "chau-dai-duong", "proxy-mmo"]
    },
    {
      slug: "proxy-dan-cu",
      title: "Proxy Dân cư",
      panelTitle: "PROXIES RESIDENTIAL IPV4",
      href: "/tat-ca-khu-vuc",
      regionKeys: ["chau-a", "chau-au", "chau-my", "chau-phi", "chau-dai-duong", "proxy-mmo"]
    },
    {
      slug: "proxy-dan-cu-viet-nam",
      title: "Proxy dân cư Việt Nam",
      panelTitle: "PROXY DÂN CƯ VIỆT NAM",
      href: "/tat-ca-khu-vuc/proxy-viet-nam",
      regionKeys: ["vn-tinh", "proxy-mmo"],
      customRegions: {
        "vn-tinh": {
          slug: "vn-tinh",
          title: "Tỉnh / Thành",
          icon: "vn",
          countries: PROXY_VN_CITIES
        }
      }
    }
  ]
};

if (typeof window !== "undefined") {
  window.CATEGORY_TAXONOMY = CATEGORY_TAXONOMY;
  window.PROXY_MEGA_REGIONS = PROXY_MEGA_REGIONS;
  window.PROXY_VN_CITIES = PROXY_VN_CITIES;
}

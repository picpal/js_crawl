import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { load } from "cheerio";

class CoupangOrderListCrawler {
  constructor(credentials) {
    this.credentials = credentials;
    puppeteer.use(StealthPlugin());
  }

  async setPage() {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--disable-gpu",
          "--lang=ko_KR",
          // 기타 옵션 추가
        ],
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
      );
      return { browser, page };
    } catch (error) {
      console.error("Error setting up page:", error);
      throw error;
    }
  }

  async login({ page, credentials }) {
    await page.goto(
      "https://login.coupang.com/login/login.pang?rtnUrl=https%3A%2F%2Fwww.coupang.com%2Fnp%2Fpost%2Flogin%3Fr%3Dhttps%253A%252F%252Fwww.coupang.com%252F"
    );
    const [loginEmailInput] = await page.$x('//*[@id="login-email-input"]');
    const [loginPasswordInput] = await page.$x(
      '//*[@id="login-password-input"]'
    );
    await loginEmailInput.type(credentials.email);
    await loginPasswordInput.type(credentials.password);
    const [loginButton] = await page.$x(
      "/html/body/div[1]/div/div/form/div[5]/button"
    );
    await loginButton.click();
    await page.waitForNavigation();
    const [mypageButton] = await page.$x(
      '//*[@id="header"]/section/div/ul/li[1]/a'
    );
    if (!mypageButton) {
      await browser.close();
      throw new Error("로그인에 실패했습니다.");
    }
  }

  parseOrderItems(orderInfo) {
    const result = [];
    const $ = load(orderInfo.html());

    const itemElements = orderInfo
      .children("div:nth-child(3)")
      .find("div div div div:nth-child(2n)")
      .find("div a:nth-child(2n)")
      .toArray(); // 물품

    for (let i = 0; i < itemElements.length; i += 2) {
      const name = $(itemElements[i]).text();
      const price = $(itemElements[i + 1])
        .find("div:nth-child(1) div > span:nth-child(1)")
        .text();
      const quantity = $(itemElements[i + 1])
        .find("div:nth-child(1) div > span:nth-child(3)")
        .text();

      result.push({ name, price, quantity });
    }
    return result;
  }

  convToDate(dateString) {
    const dateRegex = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/;
    const match = dateString.match(dateRegex);

    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, "0");
      const day = match[3];

      return `${year}${month}${day}`;
    }
  }

  generateUID() {
    const date = new Date();
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const time = date.getTime().toString();
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    return `${year}${month}${day}${time}${random}`;
  }

  async crawl({ page }) {
    // 주문목록 페이지 이동
    await page.goto("https://mc.coupang.com/ssr/desktop/order/list");

    // 주문목록 확인
    const [orderListTitle] = await page.$x(
      '//*[@id="__next"]/div[2]/div[2]/div/div[1]'
    );

    // 주문목록이 없으면 종료
    if (!orderListTitle) {
      throw new Error("주문목록이 존재하지 않습니다.");
    }

    // 주문목록 wrapper
    const content = await page.content();
    const $ = load(content);
    const orderListWrapper = $(
      "#contents div div div:nth-child(3) > div:nth-child(3) > div > div:nth-child(4)"
    );

    // 주문 정보 parsing
    const orders = orderListWrapper.children("div").toArray();

    const result = [];
    for (const order of orders) {
      const itemArr = [];
      const goodsArr = [];
      const goodsList = $(order).children("div").toArray();

      // 상품 정보가 없으면 pass
      if (goodsList.length === 0) continue;

      // 상품정보가 있는 경우
      for (const goods of goodsList) {
        const orderDateTxt =
          $(goods).children("div:nth-child(1)").text() ?? "none order date";
        const orderDate = convToDate(orderDateTxt);
        const uid = generateUID();
        if (orderDate) itemArr.push({ uid, orderDate });

        const orderInfo = $(goods)
          .children("table")
          .children("tbody")
          .children("tr")
          .children("td:nth-child(1)");

        if (orderInfo) {
          if (orderInfo.toArray().length === 0) continue;
          const orderStatus = orderInfo.children("div:nth-child(1)").text(); // 배송상태
          const goodsInfo = parseOrderItems(orderInfo); // 물품 정보

          goodsArr.push({ orderStatus, goodsInfo });
        }
      }

      itemArr.push(goodsArr);
      result.push(itemArr);
    }

    // 파싱 결과
    console.log(JSON.stringify(result));
  }
}

// 쿠팡 크롤링 실행
(async () => {
  const crl = new CoupangOrderListCrawler({
    email: "g",
    password: "g",
  });

  const page = await crl.setPage();
  await crl.login(page);
  await crl.crawl(page);
})();

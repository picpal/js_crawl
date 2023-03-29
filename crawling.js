// import { launch } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { load } from "cheerio";

puppeteer.use(StealthPlugin());

async function setPage() {
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

    // await page.setUserAgent(
    //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"
    // );

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
    );

    return { page, browser };
  } catch (error) {
    console.error("Error setting up page:", error);
    throw error;
  }
}

// 쿠팡 로그인
async function login({ page, browser }) {
  await page.goto(
    "https://login.coupang.com/login/login.pang?rtnUrl=https%3A%2F%2Fwww.coupang.com%2Fnp%2Fpost%2Flogin%3Fr%3Dhttps%253A%252F%252Fwww.coupang.com%252F"
  );
  const [loginEmailInput] = await page.$x('//*[@id="login-email-input"]');
  const [loginPasswordInput] = await page.$x('//*[@id="login-password-input"]');
  await loginEmailInput.type("g");
  await loginPasswordInput.type("g");
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
  return { page, browser };
}

// 쿠팡 구매목록 파싱
function parseOrderItems(orderInfo) {
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

// 쿠팡 주문일자 파싱
const convToDate = (dateString) => {
  const dateRegex = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/;
  const match = dateString.match(dateRegex);

  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, "0");
    const day = match[3];

    return `${year}${month}${day}`;
  }
};

// 주문건의 uid 생성
function generateUID() {
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

// 쿠팡 주문내역 페이지 크롤링
async function crawl({ page, browser }) {
  // 주문목록 페이지 이동
  await page.goto("https://mc.coupang.com/ssr/desktop/order/list");

  // 주문목록 확인
  const [orderListTitle] = await page.$x(
    '//*[@id="__next"]/div[2]/div[2]/div/div[1]'
  );

  // 주문목록이 확인
  if (!orderListTitle) {
    // 확인용 스크린샷. ( headless false 인 경우 접속이 안되어 headless 모드로 진입 )
    // await page.screenshot({ path: "testresult.png", fullPage: true });
    console.log("실패");
    // 브라우저 종료
    await browser.close();
  }

  // 현재 페이지의 html정보를 로드
  const content = await page.content();
  const $ = load(content);

  // 주문목록 wrapper
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

  // 브라우저 종료
  await browser.close();
}

// 쿠팡 크롤링 실행
(async () => {
  const page = await setPage();
  await login(page);
  await crawl(page);
})();

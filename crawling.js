// import { launch } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { load } from "cheerio";

puppeteer.use(StealthPlugin());

const getElementByXpath = (path) => {
  return document.evaluate(
    path,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null
  ).singleNodeValue;
};

async function crawl() {
  // 가상 브라우져를 실행, headless: false를 주면 벌어지는 일을 새로운 창을 열어 보여준다(default: true)
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--lang=ko_KR",
      // 기타 옵션 추가
    ],
  });

  const page = await browser.newPage();
  const ndhs_id = "novten2018@gmail.com"; // 추후 로그인 폼에서 각자의 아이디 비밀번호를 입력받게 할 예정
  const ndhs_pw = "misopia1!";

  // headless: false일때 브라우져 크기 지정해주는 코드
  // await page.setViewport({
  //     width: 1366,
  //     height: 768
  // });

  // 사람처럼 보이게 하기
  // 1. User-Agent 변경
  // await page.setUserAgent(
  //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
  // );

  // 2. 브라우저 엔진 변경
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"
  );

  //쿠팡 로그인 페이지로 이동
  await page.goto(
    "https://login.coupang.com/login/login.pang?rtnUrl=https%3A%2F%2Fwww.coupang.com%2Fnp%2Fpost%2Flogin%3Fr%3Dhttps%253A%252F%252Fwww.coupang.com%252F"
  );

  // 3. 너무 빠르게 진행하지 않기 위해서 timeout 으로 딜레이 부여
  // await new Promise((resolve) => setTimeout(resolve, 1000));

  //아이디랑 비밀번호 란에 값을 넣어라
  await page.evaluate(
    (id, pw) => {
      function getElementByXpath(path) {
        return document.evaluate(
          path,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      }

      // 아이디랑 비밀번호 란에 값을 넣어라
      getElementByXpath('//*[@id="login-email-input"]').value = id;
      getElementByXpath('//*[@id="login-password-input"]').value = pw;
    },
    ndhs_id,
    ndhs_pw
  );

  //로그인 버튼을 클릭해라
  const [loginButton] = await page.$x(
    "/html/body/div[1]/div/div/form/div[5]/button"
  );
  await loginButton.click();

  //로그인 화면이 전환될 때까지 기다려라, headless: false 일때는 필요 반대로 headless: true일때는 없어야 되는 코드
  await page.waitForNavigation();

  // 확인용 스크린샷. ( headless false 인 경우 접속이 안되어 headless 모드로 진입 )
  // await page.screenshot({ path: "testresult.png", fullPage: true });

  // const myCoupangBtn = getElementByXpath(
  //   '//*[@id="header"]/section/div/ul/li[1]/a'
  // );

  // 로그인 성공 시(화면 전환 성공 시)
  if (true) {
    // 주문목록 페이지 이동
    await page.goto("https://mc.coupang.com/ssr/desktop/order/list");

    // 현재 페이지의 html정보를 로드
    const content = await page.content();
    const $ = load(content);

    // 주문목록 wrapper
    const lists = $(
      "#contents div div div:nth-child(3) > div:nth-child(3) > div > div:nth-child(4)"
    );

    const items = lists.children("div").toArray();
    for (const item of items) {
      const goods = $(item).children("div").toArray();

      // 상품 정보가 없으면 pass
      if (goods.length === 0) continue;

      // 상품정보가 있는 경우
      for (const a of goods) {
        const $A01 = $(a).children("div:nth-child(1)");
        const $A02 = $(a).children("table");

        if ($A01) $A01.text();
        if ($A02) {
          const info = $A02
            .children("tbody")
            .children("tr")
            .children("td:nth-child(1)")
            .children("div")
            .text();

          // 텍스트를 줄 단위로 나눔
          const lines = info.split("\n");
          console.log(lines);
        }
      }
    }
  }
  //로그인 실패시
  else {
    console.log("실패");
    ndhs_id = "nope";
    ndhs_pw = "nope";
  }

  // //브라우저 꺼라
  await browser.close();
}

crawl();

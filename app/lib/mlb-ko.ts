export const MLB_TEAM_KO_BY_ID: Record<number, string> = {
  108: "LA 에인절스", 109: "애리조나 다이아몬드백스", 110: "볼티모어 오리올스",
  111: "보스턴 레드삭스", 112: "시카고 컵스", 113: "신시내티 레즈",
  114: "클리블랜드 가디언스", 115: "콜로라도 로키스", 116: "디트로이트 타이거스",
  117: "휴스턴 애스트로스", 118: "캔자스시티 로열스", 119: "LA 다저스",
  120: "워싱턴 내셔널스", 121: "뉴욕 메츠", 133: "애슬레틱스",
  134: "피츠버그 파이리츠", 135: "샌디에이고 파드리스", 136: "시애틀 매리너스",
  137: "샌프란시스코 자이언츠", 138: "세인트루이스 카디널스", 139: "탬파베이 레이스",
  140: "텍사스 레인저스", 141: "토론토 블루제이스", 142: "미네소타 트윈스",
  143: "필라델피아 필리스", 144: "애틀랜타 브레이브스", 145: "시카고 화이트삭스",
  146: "마이애미 말린스", 147: "뉴욕 양키스", 158: "밀워키 브루어스",
};

export const MLB_TEAM_KO_BY_EN: Record<string, string> = {
  "Los Angeles Angels": "LA 에인절스", "Arizona Diamondbacks": "애리조나 다이아몬드백스",
  "Baltimore Orioles": "볼티모어 오리올스", "Boston Red Sox": "보스턴 레드삭스",
  "Chicago Cubs": "시카고 컵스", "Cincinnati Reds": "신시내티 레즈",
  "Cleveland Guardians": "클리블랜드 가디언스", "Colorado Rockies": "콜로라도 로키스",
  "Detroit Tigers": "디트로이트 타이거스", "Houston Astros": "휴스턴 애스트로스",
  "Kansas City Royals": "캔자스시티 로열스", "Los Angeles Dodgers": "LA 다저스",
  "Washington Nationals": "워싱턴 내셔널스", "New York Mets": "뉴욕 메츠",
  "Athletics": "애슬레틱스", "Oakland Athletics": "애슬레틱스",
  "Pittsburgh Pirates": "피츠버그 파이리츠", "San Diego Padres": "샌디에이고 파드리스",
  "Seattle Mariners": "시애틀 매리너스", "San Francisco Giants": "샌프란시스코 자이언츠",
  "St. Louis Cardinals": "세인트루이스 카디널스", "Tampa Bay Rays": "탬파베이 레이스",
  "Texas Rangers": "텍사스 레인저스", "Toronto Blue Jays": "토론토 블루제이스",
  "Minnesota Twins": "미네소타 트윈스", "Philadelphia Phillies": "필라델피아 필리스",
  "Atlanta Braves": "애틀랜타 브레이브스", "Chicago White Sox": "시카고 화이트삭스",
  "Miami Marlins": "마이애미 말린스", "New York Yankees": "뉴욕 양키스",
  "Milwaukee Brewers": "밀워키 브루어스",
};

const CURRENT_MLB_PITCHER_KO: Record<string, string> = {
  "Quinn Mathews": "퀸 매튜스",
  "Kent Emanuel": "켄트 이매뉴얼",
  "Andrew Painter": "앤드류 페인터",
  "Brandon Young": "브랜든 영",
  "브랜든 Young": "브랜든 영",
  "Shane McClanahan": "셰인 맥클라나한",
  "셰인 McClanahan": "셰인 맥클라나한",
  "Andre Pallante": "안드레 팔란테",
  "Rhett Lowder": "렛 라우더",
  "Janson Junk": "잰슨 정크",
  "Cristopher Sánchez": "크리스토퍼 산체스",
  "크리스토퍼 Sánchez": "크리스토퍼 산체스",
  "Framber Valdez": "프람버 발데스",
  "Carmen Mlodzinski": "카르멘 모진스키",
  "Mitch Bratt": "미치 브랫",
  "Alec Gamboa": "알렉 감보아",
  "알렉 Gamboa": "알렉 감보아",
  "Walker Buehler": "워커 뷸러",
  "워커 Buehler": "워커 뷸러",
  "Nolan McLean": "놀란 맥린",
  "Mason Barnett": "메이슨 바넷",
  "Michael Wacha": "마이클 와카",
  "마이클 Wacha": "마이클 와카",
  "Martín Pérez": "마르틴 페레스",
  "Martin Perez": "마르틴 페레스",
  "Bailey Ober": "베일리 오버",
  "Luis Castillo": "루이스 카스티요",
  "Shota Imanaga": "이마나가 쇼타",
  "Blake Snell": "블레이크 스넬",
  "Tomoyuki Sugano": "스가노 도모유키",
};

// 일정 카드와 상세 화면이 같은 이름을 사용하도록 공식 MLB 선수 ID를 우선합니다.
const MLB_PITCHER_KO_BY_ID: Record<number, string> = {
  519242: "크리스 세일",
  694819: "제이콥 미시오로스키",
  690928: "헌터 도빈스",
  666200: "헤수스 루사르도",
  689254: "메이슨 플루하티",
  693645: "캠 슐리틀러",
  657277: "로건 웹",
  543243: "소니 그레이",
  695418: "브래드 로드",
  687473: "라이언 구스토",
  642547: "프레디 페랄타",
  669432: "트레버 로저스",
  640455: "션 머나야",
  680732: "션 버크",
  675512: "트로이 멜튼",
  702070: "노아 캐머런",
  669372: "J.T. 긴",
  669713: "헤이든 웨스네스키",
  672282: "리드 데트머스",
  669022: "맥켄지 고어",
  676282: "조이 칸티요",
  685299: "태너 고든",
  666157: "닉 로돌로",
  593958: "에두아르도 로드리게스",
  687570: "코너 프릴립",
  681190: "랜디 바스케스",
  696149: "버바 챈들러",
  808967: "야마모토 요시노부",
  571510: "매튜 보이드",
  676106: "에머슨 행콕",
};

const PLAYER_NAME_KO: Record<string, string> = {
  "Christian Scott": "크리스티안 스콧", "Bryce Elder": "브라이스 엘더",
  "Trevor Rogers": "트레버 로저스", "Dean Kremer": "딘 크레머",
  "Andrew Painter": "앤드루 페인터", "Hunter Dobbins": "헌터 도빈스",
  "Gabriel Hughes": "게이브리얼 휴스", "Michael Soroka": "마이클 소로카",
  "Logan Henderson": "로건 헨더슨", "Casey Mize": "케이시 마이즈",
  "Hayden Wesneski": "헤이든 웨스네스키", "Blade Tidwell": "블레이드 티드웰",
  "Noah Cameron": "노아 캐머런", "Jacob Lopez": "제이콥 로페스",
  "Tomoyuki Sugano": "스가노 도모유키", "Shane Drohan": "셰인 드로한", "Simeon Drohan": "셰인 드로한",
  "Joe Ryan": "조 라이언", "Tanner Bibee": "태너 바이비", "Sean Burke": "션 버크",
  "Trey Yesavage": "트레이 예세비지", "Shohei Ohtani": "오타니 쇼헤이",
  "Yoshinobu Yamamoto": "야마모토 요시노부", "Shota Imanaga": "이마나가 쇼타",
  "Kodai Senga": "센가 고다이", "Yu Darvish": "다르빗슈 유", "Yusei Kikuchi": "기쿠치 유세이",
  "Roki Sasaki": "사사키 로키", "Masataka Yoshida": "요시다 마사타카",
  "Jung Hoo Lee": "이정후", "Ha-Seong Kim": "김하성", "Ji Hwan Bae": "배지환",
  "Hyeseong Kim": "김혜성", "Kenta Maeda": "마에다 겐타", "Merrill Kelly": "메릴 켈리",
  "Clayton Kershaw": "클레이튼 커쇼", "Gerrit Cole": "게릿 콜", "Max Scherzer": "맥스 슈어저",
  "Justin Verlander": "저스틴 벌랜더", "Chris Sale": "크리스 세일", "Blake Snell": "블레이크 스넬",
  "Zack Wheeler": "잭 휠러", "Corbin Burnes": "코빈 번스", "Tarik Skubal": "타릭 스쿠발",
  "Paul Skenes": "폴 스킨스", "Logan Webb": "로건 웹", "George Kirby": "조지 커비",
  "Luis Castillo": "루이스 카스티요", "Framber Valdez": "프람버 발데스", "Hunter Brown": "헌터 브라운",
  "Jacob deGrom": "제이콥 디그롬", "Nathan Eovaldi": "네이선 이볼디", "Cole Ragans": "콜 레이건스",
  "Seth Lugo": "세스 루고", "Carlos Rodon": "카를로스 로돈", "Nestor Cortes": "네스터 코르테스",
  "Kevin Gausman": "케빈 가우스먼", "Jose Berrios": "호세 베리오스", "Chris Bassitt": "크리스 배싯",
  "Sonny Gray": "소니 그레이", "Pablo Lopez": "파블로 로페스", "Bailey Ober": "베일리 오버",
  "Reid Detmers": "리드 데트머스", "Tyler Anderson": "타일러 앤더슨", "Jack Flaherty": "잭 플래허티",
  "Spencer Strider": "스펜서 스트라이더", "Reynaldo Lopez": "레이날도 로페스", "Aaron Nola": "애런 놀라",
  "Ranger Suarez": "레인저 수아레스", "Cristopher Sanchez": "크리스토퍼 산체스", "Dylan Cease": "딜런 시즈",
  "Michael King": "마이클 킹", "Freddy Peralta": "프레디 페랄타", "Brandon Woodruff": "브랜든 우드러프",
  "Kyle Hendricks": "카일 헨드릭스", "Justin Steele": "저스틴 스틸", "Hunter Greene": "헌터 그린",
  "Andrew Abbott": "앤드루 애벗", "Sandy Alcantara": "샌디 알칸타라", "Eury Perez": "유리 페레스",
  "MacKenzie Gore": "맥켄지 고어", "Jameson Taillon": "제이미슨 타이욘", "Charlie Morton": "찰리 모턴",
  "Craig Kimbrel": "크레이그 킴브럴", "Kenley Jansen": "켄리 잰슨", "Josh Hader": "조시 헤이더",
  "Emmanuel Clase": "에마누엘 클라세", "Devin Williams": "데빈 윌리엄스", "Ryan Helsley": "라이언 헬슬리",
};

const FIRST: Record<string, string> = {
  joe:"조", jose:"호세", juan:"후안", luis:"루이스", carlos:"카를로스", chris:"크리스",
  christopher:"크리스토퍼", cristopher:"크리스토퍼", michael:"마이클", mike:"마이크", matt:"맷",
  matthew:"매튜", john:"존", jon:"존", josh:"조시", joshua:"조슈아", jake:"제이크", jacob:"제이콥",
  jack:"잭", james:"제임스", jameson:"제이미슨", justin:"저스틴", tyler:"타일러", tanner:"태너",
  trey:"트레이", sean:"션", shane:"셰인", spencer:"스펜서", hunter:"헌터", brandon:"브랜든",
  brian:"브라이언", bryan:"브라이언", ryan:"라이언", reid:"리드", reed:"리드", kyle:"카일",
  kevin:"케빈", cole:"콜", corey:"코리", clayton:"클레이튼", max:"맥스", paul:"폴", pablo:"파블로",
  george:"조지", logan:"로건", aaron:"애런", andrew:"앤드루", andy:"앤디", alex:"알렉스",
  alec:"알렉", adam:"애덤", eric:"에릭", ethan:"이선", evan:"에번", emmanuel:"에마누엘",
  freddy:"프레디", frankie:"프랭키", gavin:"개빈", garrett:"개릿", gerrit:"게릿", greg:"그레그",
  nick:"닉", nathan:"네이선", nate:"네이트", noah:"노아", patrick:"패트릭", peter:"피터",
  robbie:"로비", robert:"로버트", ronel:"로넬", sandy:"샌디", seth:"세스", sonny:"소니",
  steven:"스티븐", stephen:"스티븐", tommy:"토미", triston:"트리스턴", walker:"워커", will:"윌",
  william:"윌리엄", zach:"잭", zack:"잭", zachary:"재커리", bailey:"베일리", blake:"블레이크",
  corbin:"코빈", dylan:"딜런", framber:"프람버", kodai:"고다이", kenta:"겐타", yusei:"유세이",
  aj:"A.J.", abner:"애브너", adrian:"아드리안", alan:"앨런", albert:"알버트", aroldis:"아롤디스",
  ben:"벤", bradgley:"브래즐리", brady:"브래디", brandyn:"브랜든", brayan:"브라얀", braydon:"브레이든",
  brendon:"브렌던", brennan:"브레넌", brent:"브렌트", brett:"브렛", brooks:"브룩스",
  cal:"칼", caleb:"케일럽", cam:"캠", carson:"카슨", casey:"케이시", chad:"채드", chase:"체이스",
  daniel:"대니얼", danny:"대니", didier:"디디에르", easton:"이스턴", edgardo:"에드가르도", edwin:"에드윈",
  elvis:"엘비스", enyel:"에니엘", gerardo:"헤라르도", gordon:"고든", grant:"그랜트", hogan:"호건",
  jt:"J.T.", dl:"D.L.", jason:"제이슨", jeff:"제프", jeremiah:"제러마이아", jhoan:"조안", jimmy:"지미", jonathan:"조나단", jordan:"조던",
  jovani:"조바니", keaton:"키턴", kody:"코디", lazaro:"라자로", louis:"루이", lucas:"루카스", luke:"루크",
  lyon:"라이언", mason:"메이슨", orion:"오리온", parker:"파커", peyton:"페이튼",
  raisel:"라이셀", raymond:"레이먼드", reiver:"레이버", rico:"리코", riley:"라일리", robby:"로비",
  sam:"샘", samy:"새미", scott:"스콧", shaun:"숀", simeon:"시미언", tayler:"테일러", taylor:"테일러",
  tim:"팀", travis:"트래비스", trent:"트렌트", trevor:"트레버", tyron:"타이론", victor:"빅터",
  xzavion:"재비언", yaramil:"야라밀", yoendrys:"요엔드리스", yuki:"유키",
};

const LAST: Record<string, string> = {
  ryan:"라이언", bibee:"바이비", burke:"버크", yesavage:"예세비지", smith:"스미스", johnson:"존슨",
  williams:"윌리엄스", brown:"브라운", jones:"존스", miller:"밀러", davis:"데이비스", garcia:"가르시아",
  rodriguez:"로드리게스", martinez:"마르티네스", hernandez:"에르난데스", lopez:"로페스", gonzalez:"곤살레스",
  sanchez:"산체스", castillo:"카스티요", valdez:"발데스", suarez:"수아레스", ramirez:"라미레스",
  wheeler:"휠러", sale:"세일", snell:"스넬", skubal:"스쿠발", skenes:"스킨스", webb:"웹", kirby:"커비",
  gausman:"가우스먼", berrios:"베리오스", bassitt:"배싯", gray:"그레이", ober:"오버", detmers:"데트머스",
  anderson:"앤더슨", flaherty:"플래허티", strider:"스트라이더", nola:"놀라", cease:"시즈", king:"킹",
  peralta:"페랄타", woodruff:"우드러프", hendricks:"헨드릭스", steele:"스틸", greene:"그린",
  abbott:"애벗", alcantara:"알칸타라", perez:"페레스", gore:"고어", taillon:"타이욘", morton:"모턴",
  kimbrel:"킴브럴", jansen:"잰슨", hader:"헤이더", clase:"클라세", helsley:"헬슬리", cole:"콜",
  kershaw:"커쇼", scherzer:"슈어저", verlander:"벌랜더", burnes:"번스", ragans:"레이건스", lugo:"루고",
  rodon:"로돈", cortes:"코르테스", eovaldi:"이볼디", degrom:"디그롬", kelly:"켈리", sugano:"스가노", drohan:"드로한",
  minter:"민터", blubaugh:"블루바우", ashby:"애슈비", uribe:"우리베", morejon:"모레혼", rangel:"랑헬",
  surez:"수아레스", hoppe:"호페", lange:"랭", vesia:"베시아", kittredge:"키트리지",
  morris:"모리스", chapman:"채프먼", joyce:"조이스", weiman:"와이먼", basso:"바소",
  bello:"베요", fisher:"피셔", little:"리틀", bernardino:"베르나르디노", suter:"수터",
  kerry:"케리", raley:"레일리", baker:"베이커", quantrill:"콴트릴", ferguson:"퍼거슨",
  kilian:"킬리언", booser:"부저", sanders:"샌더스", seymour:"시모어", legumina:"레구미나", patrick:"패트릭",
  shugart:"슈가트", silseth:"실세스", roycroft:"로이크로프트", winn:"윈", hall:"홀", duarte:"두아르테",
  young:"영", fuentes:"푸엔테스", dodd:"도드", mcgee:"맥기", henriquez:"엔리케스", diaz:"디아스", daz:"디아스",
  alvarado:"알바라도", santos:"산토스", phillips:"필립스", cleavinger:"클리빙어", whitlock:"위틀록",
  soriano:"소리아노", carrillo:"카리요", graceffo:"그라세포", wolfram:"울프럼", harris:"해리스",
  brubaker:"브루베이커", dreyer:"드라이어", weisenburger:"와이젠버거", latz:"래츠", foley:"폴리", hoffman:"호프먼",
  estrada:"에스트라다", duran:"듀란", herget:"허겟", schreiber:"슈라이버", bowlan:"볼런",
  loaisiga:"로아이시가", loisiga:"로아이시가", pintaro:"핀타로", montgomery:"몽고메리", romano:"로마노", cuas:"쿠아스", rojas:"로하스",
  walker:"워커", fermin:"페르민", moran:"모란", morn:"모란", mejia:"메히아", bruihl:"브루일", slaten:"슬레이튼",
  ginkel:"긴켈", funderburk:"펀더버크", hart:"하트", hurt:"허트", varland:"발랜드", erceg:"어섹",
  gastelum:"가스텔룸", medina:"메디나", torrens:"토렌스", murphy:"머피", richardson:"리처드슨", fluharty:"플루하티",
  lavender:"라벤더", pearson:"피어슨", frasso:"프라소", kerkering:"커커링", mushinski:"무신스키", strzelecki:"스트젤레키",
  iglesias:"이글레시아스", burgos:"부르고스", sanmartin:"산마르틴", obrien:"오브라이언", ahlstrom:"알스트롬",
  watson:"왓슨", hentges:"헨지스", natera:"나테라", blewett:"블루잇", woods:"우즈", waldron:"월드론",
  miles:"마일스", cruz:"크루즈", matz:"마츠", okert:"오커트", gordon:"고든", saucedo:"사우세도",
  clarke:"클라크", rogers:"로저스", mayza:"메이자", nance:"낸스", adams:"애덤스", megill:"메길",
  alexander:"알렉산더", heineman:"하이네만", kinley:"킨리", wells:"웰스", guerrero:"게레로", mederos:"메데로스",
  curry:"커리", hiraldo:"히랄도", gomez:"고메스", gmez:"고메스", matsui:"마쓰이", agnos:"아그노스", littell:"리텔",
  de:"데", los:"로스", jr:"주니어", jos:"호세", hernndez:"에르난데스", "o'brien":"오브라이언", senga:"센가",
};

export function teamNameKo(name: string, id?: number) {
  return (id ? MLB_TEAM_KO_BY_ID[id] : undefined) ?? MLB_TEAM_KO_BY_EN[name] ?? name;
}

export function playerNameKo(name: string) {
  if (!name) return "";
  if (CURRENT_MLB_PITCHER_KO[name]) return CURRENT_MLB_PITCHER_KO[name];
  if (PLAYER_NAME_KO[name]) return PLAYER_NAME_KO[name];
  const parts = name.replace(/\./g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  const mapped = parts.map((part, index) => {
    const key = part.toLowerCase().replace(/[^a-z'-]/g, "");
    return PLAYER_NAME_KO[part] ?? (index === 0 ? FIRST[key] : LAST[key]) ?? part;
  });
  return mapped.map((part) => /[A-Za-z]/.test(part) ? fallbackPlayerTokenKo(part) : part).join(" ");
}

export function playerNameKoById(name: string, id?: number | string) {
  const playerId = Number(id);
  return MLB_PITCHER_KO_BY_ID[playerId] ?? playerNameKo(name);
}

export function knownPlayerNameKo(name: string, id?: number | string) {
  return MLB_PITCHER_KO_BY_ID[Number(id)] ?? CURRENT_MLB_PITCHER_KO[name] ?? PLAYER_NAME_KO[name] ?? "";
}

export async function playerNameKoAuto(name: string, id?: number | string) {
  if (!name) return "";
  const fixed = MLB_PITCHER_KO_BY_ID[Number(id)];
  if (fixed) return fixed;
  const exact = CURRENT_MLB_PITCHER_KO[name] ?? PLAYER_NAME_KO[name];
  if (exact) return exact;
  if (/[가-힣]/.test(name) && !/[A-Za-z]/.test(name)) return name;
  try {
    const params = new URLSearchParams({ client: "gtx", sl: "en", tl: "ko", dt: "t", q: name });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const payload = await response.json();
      const translated = Array.isArray(payload?.[0]) ? payload[0].map((row: unknown[]) => String(row?.[0] ?? "")).join("").trim() : "";
      if (/[가-힣]/.test(translated) && !/[A-Za-z]/.test(translated)) return translated;
    }
  } catch {
    // 외부 음역 서비스 장애 시 내부 이름 사전을 사용합니다.
  }
  return playerNameKo(name);
}

// MLB 전체 선수 명단은 매일 바뀌므로 사전에 없는 이름도 영문 그대로 노출하지 않는다.
// 자주 쓰이는 음절을 먼저 치환하고 남은 알파벳까지 한글 음가로 바꾼다.
function fallbackPlayerTokenKo(value: string) {
  const chunks: Array<[string, string]> = [
    ["sch", "스"], ["tch", "치"], ["dge", "지"], ["tion", "션"], ["sion", "전"],
    ["ch", "치"], ["sh", "시"], ["th", "스"], ["ph", "프"], ["wh", "우"],
    ["ck", "크"], ["qu", "퀴"], ["ng", "응"], ["son", "슨"], ["ton", "턴"],
    ["man", "먼"], ["ley", "리"], ["ney", "니"], ["er", "어"], ["or", "어"],
    ["ar", "아"], ["ez", "에스"], ["es", "에스"], ["ll", "ㄹ"], ["rr", "ㄹ"],
  ];
  let source = value.toLowerCase().replace(/[^a-z'-]/g, "");
  let result = "";
  const letters: Record<string, string> = {
    a:"아",b:"브",c:"크",d:"드",e:"에",f:"프",g:"그",h:"흐",i:"이",j:"지",k:"크",l:"르",m:"므",
    n:"느",o:"오",p:"프",q:"크",r:"르",s:"스",t:"트",u:"우",v:"브",w:"우",x:"크스",y:"이",z:"즈",
    "-":"-", "'":"",
  };
  while (source) {
    const chunk = chunks.find(([roman]) => source.startsWith(roman));
    if (chunk) {
      result += chunk[1];
      source = source.slice(chunk[0].length);
    } else {
      result += letters[source[0]] ?? "";
      source = source.slice(1);
    }
  }
  return result || value;
}

export const MLB_VENUE_KO: Record<string, string> = {
  "Rogers Centre":"로저스 센터", "Guaranteed Rate Field":"개런티드 레이트 필드",
  "Yankee Stadium":"양키 스타디움", "Dodger Stadium":"다저 스타디움", "Wrigley Field":"리글리 필드",
  "Fenway Park":"펜웨이 파크", "Citi Field":"시티 필드", "Oracle Park":"오라클 파크",
  "Petco Park":"펫코 파크", "T-Mobile Park":"T-모바일 파크", "Target Field":"타깃 필드",
  "Progressive Field":"프로그레시브 필드", "Comerica Park":"코메리카 파크", "Minute Maid Park":"미닛메이드 파크",
  "Kauffman Stadium":"카우프만 스타디움", "Nationals Park":"내셔널스 파크", "PNC Park":"PNC 파크",
  "Busch Stadium":"부시 스타디움", "Tropicana Field":"트로피카나 필드", "Globe Life Field":"글로브 라이프 필드",
  "Citizens Bank Park":"시티즌스 뱅크 파크", "Truist Park":"트루이스트 파크", "loanDepot park":"론디포 파크",
  "American Family Field":"아메리칸 패밀리 필드", "Coors Field":"쿠어스 필드", "Chase Field":"체이스 필드",
  "Camden Yards":"캠든 야즈", "Oriole Park at Camden Yards":"캠든 야즈", "Sutter Health Park":"서터 헬스 파크",
};

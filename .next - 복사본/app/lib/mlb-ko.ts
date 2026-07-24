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

const PLAYER_NAME_KO: Record<string, string> = {
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
  rodon:"로돈", cortes:"코르테스", eovaldi:"이볼디", degrom:"디그롬", kelly:"켈리",
};

export function teamNameKo(name: string, id?: number) {
  return (id ? MLB_TEAM_KO_BY_ID[id] : undefined) ?? MLB_TEAM_KO_BY_EN[name] ?? name;
}

export function playerNameKo(name: string) {
  if (!name) return "";
  if (PLAYER_NAME_KO[name]) return PLAYER_NAME_KO[name];
  const parts = name.replace(/\./g, "").split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  const mapped = parts.map((part, index) => {
    const key = part.toLowerCase().replace(/[^a-z'-]/g, "");
    return PLAYER_NAME_KO[part] ?? (index === 0 ? FIRST[key] : LAST[key]) ?? part;
  });
  return mapped.join(" ");
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

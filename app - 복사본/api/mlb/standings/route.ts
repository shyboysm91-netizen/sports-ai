import { NextResponse } from "next/server";

const TEAM_KO: Record<number, string> = {108:"로스앤젤레스 에인절스",109:"애리조나 다이아몬드백스",110:"볼티모어 오리올스",111:"보스턴 레드삭스",112:"시카고 컵스",113:"신시내티 레즈",114:"클리블랜드 가디언스",115:"콜로라도 로키스",116:"디트로이트 타이거스",117:"휴스턴 애스트로스",118:"캔자스시티 로열스",119:"로스앤젤레스 다저스",120:"워싱턴 내셔널스",121:"뉴욕 메츠",133:"오클랜드 애슬레틱스",134:"피츠버그 파이리츠",135:"샌디에이고 파드리스",136:"시애틀 매리너스",137:"샌프란시스코 자이언츠",138:"세인트루이스 카디널스",139:"탬파베이 레이스",140:"텍사스 레인저스",141:"토론토 블루제이스",142:"미네소타 트윈스",143:"필라델피아 필리스",144:"애틀랜타 브레이브스",145:"시카고 화이트삭스",146:"마이애미 말린스",147:"뉴욕 양키스",158:"밀워키 브루어스"};

type RecordRow = {
  team?: { id?: number; name?: string };
  divisionRank?: string;
  leagueRank?: string;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  winningPercentage?: string;
  gamesBack?: string;
  wildCardGamesBack?: string;
  streak?: { streakCode?: string };
  records?: { splitRecords?: Array<{ type?: string; wins?: number; losses?: number }> };
};
type Payload = { records?: Array<{ teamRecords?: RecordRow[] }> };

export async function GET(request: Request) {
  const seasonParam = new URL(request.url).searchParams.get("season");
  const season = /^\d{4}$/.test(seasonParam ?? "") ? seasonParam! : String(new Date().getUTCFullYear());
  try {
    const params = new URLSearchParams({ leagueId: "103,104", season, standingsTypes: "regularSeason", hydrate: "team,records" });
    const response = await fetch(`https://statsapi.mlb.com/api/v1/standings?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Sports-AI/1.0" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`MLB 순위 요청 실패: ${response.status}`);
    const payload = (await response.json()) as Payload;
    const standings = (payload.records ?? []).flatMap((record) => record.teamRecords ?? []).map((row) => {
      const home = row.records?.splitRecords?.find((item) => item.type === "home");
      const away = row.records?.splitRecords?.find((item) => item.type === "away");
      return {
        teamId: row.team?.id ?? 0,
        team: TEAM_KO[row.team?.id ?? 0] ?? row.team?.name ?? "",
        divisionRank: Number(row.divisionRank ?? 0),
        leagueRank: Number(row.leagueRank ?? 0),
        games: row.gamesPlayed ?? 0,
        wins: row.wins ?? 0,
        losses: row.losses ?? 0,
        winningPercentage: Number(row.winningPercentage ?? 0),
        gamesBehind: row.gamesBack ?? "-",
        wildCardGamesBehind: row.wildCardGamesBack ?? "-",
        streak: row.streak?.streakCode ?? "-",
        home: home ? `${home.wins ?? 0}-${home.losses ?? 0}` : "-",
        away: away ? `${away.wins ?? 0}-${away.losses ?? 0}` : "-",
      };
    });
    return NextResponse.json({ success: true, source: "MLB Stats API", season, standings });
  } catch (error) {
    return NextResponse.json({ success: false, standings: [], message: error instanceof Error ? error.message : "MLB 순위를 불러오지 못했습니다." }, { status: 500 });
  }
}

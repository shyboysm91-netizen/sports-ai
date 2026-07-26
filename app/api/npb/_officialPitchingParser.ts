export type OfficialPitchingLine = {
  starterOriginalName: string;
  playerCode: string;
  inningsOuts: number;
  battersFaced: number;
  hits: number;
  walks: number;
  hitByPitch: number;
  strikeouts: number;
  earnedRuns: number;
  runs: number;
  decision: string;
  pitches: number | null;
};

type TagName = "table" | "tr" | "td" | "th";
type Node = {
  tag: TagName;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
  parent: Node | null;
  children: Node[];
};

type Cell = { html: string; text: string };
type Row = { node: Node; cells: Cell[]; texts: string[] };
type ParsedTable = { node: Node; rows: Row[] };

function decode(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function buildTree(html: string): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];
  const token = /<\/?(table|tr|td|th)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = token.exec(html))) {
    const raw = match[0];
    const tag = match[1].toLowerCase() as TagName;
    const closing = /^<\//.test(raw);
    if (!closing) {
      const node: Node = {
        tag,
        start: match.index,
        openEnd: token.lastIndex,
        closeStart: html.length,
        end: html.length,
        parent: stack.length ? stack[stack.length - 1] : null,
        children: [],
      };
      if (node.parent) node.parent.children.push(node);
      else roots.push(node);
      stack.push(node);
      continue;
    }

    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].tag !== tag) continue;
      const node = stack[index];
      node.closeStart = match.index;
      node.end = token.lastIndex;
      stack.splice(index);
      break;
    }
  }
  return roots;
}

function flatten(nodes: Node[]): Node[] {
  const output: Node[] = [];
  const visit = (node: Node) => {
    output.push(node);
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return output;
}

function nearest(node: Node | null, tag: TagName): Node | null {
  let current = node;
  while (current) {
    if (current.tag === tag) return current;
    current = current.parent;
  }
  return null;
}

function parseTables(html: string): ParsedTable[] {
  const nodes = flatten(buildTree(html));
  const tables = nodes.filter((node) => node.tag === "table");
  const rows = nodes.filter((node) => node.tag === "tr");
  const cells = nodes.filter((node) => node.tag === "td" || node.tag === "th");

  return tables.map((table) => {
    const ownRows = rows.filter((row) => nearest(row.parent, "table") === table);
    return {
      node: table,
      rows: ownRows.map((row) => {
        const ownCells = cells
          .filter((cell) => nearest(cell.parent, "tr") === row)
          .sort((a, b) => a.start - b.start)
          .map((cell) => {
            const raw = html.slice(cell.start, cell.end);
            return { html: raw, text: decode(html.slice(cell.openEnd, cell.closeStart)) };
          });
        return { node: row, cells: ownCells, texts: ownCells.map((cell) => cell.text) };
      }),
    };
  }).sort((a, b) => a.node.start - b.node.start);
}

function key(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[.／/()（）・:\-]/g, "");
}

function indexOfHeader(headers: string[], aliases: string[]) {
  const normalized = headers.map(key);
  return normalized.findIndex((header) => aliases.some((alias) => header === key(alias)));
}

function num(value: string | undefined) {
  const parsed = Number((value || "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function inningsOuts(value: string | undefined) {
  const text = (value || "").trim().replace(/⅓/g, ".1").replace(/⅔/g, ".2");
  const match = text.match(/^(\d+)(?:\.([12]))?$/);
  if (!match) return 0;
  return Number(match[1]) * 3 + Number(match[2] || 0);
}

function isLeftHeader(texts: string[]) {
  const keys = texts.map(key);
  return keys.includes("投手") && keys.includes("投球数") && keys.includes("打者") && keys.includes("投球回");
}

function isRightHeader(texts: string[]) {
  const keys = texts.map(key);
  return (keys.includes("安打") || keys.includes("被安打"))
    && (keys.includes("四球") || keys.includes("与四球"))
    && (keys.includes("三振") || keys.includes("奪三振"))
    && (keys.includes("自責点") || keys.includes("自責"));
}

function tableParent(node: Node) {
  return nearest(node.parent, "table");
}

export function parseOfficialPitcherLine(html: string, requestedPlayerCode: string): OfficialPitchingLine | null {
  if (!requestedPlayerCode) return null;
  const tables = parseTables(html);

  for (let leftIndex = 0; leftIndex < tables.length; leftIndex += 1) {
    const left = tables[leftIndex];
    const leftHeaderIndex = left.rows.findIndex((row) => isLeftHeader(row.texts));
    if (leftHeaderIndex < 0) continue;

    const leftHeaders = left.rows[leftHeaderIndex].texts;
    const lp = {
      pitcher: indexOfHeader(leftHeaders, ["投手"]),
      pitches: indexOfHeader(leftHeaders, ["投球数", "球数"]),
      batters: indexOfHeader(leftHeaders, ["打者", "対打者"]),
      innings: indexOfHeader(leftHeaders, ["投球回", "回"]),
    };
    if (Object.values(lp).some((position) => position < 0)) continue;

    const leftData = left.rows.slice(leftHeaderIndex + 1).filter((row) =>
      row.cells.some((cell) => /\/players\/\d+\.html/i.test(cell.html)),
    );
    const playerRowIndex = leftData.findIndex((row) =>
      row.cells.some((cell) => new RegExp(`/players/${requestedPlayerCode}\\.html`, "i").test(cell.html)),
    );
    if (playerRowIndex < 0) continue;

    const sameContainer = tableParent(left.node);
    const rightCandidates = tables.filter((candidate, candidateIndex) => {
      if (candidateIndex === leftIndex) return false;
      const headerIndex = candidate.rows.findIndex((row) => isRightHeader(row.texts));
      if (headerIndex < 0) return false;
      const candidateContainer = tableParent(candidate.node);
      if (sameContainer && candidateContainer === sameContainer) return true;
      return candidate.node.start > left.node.start && candidate.node.start - left.node.end < 12000;
    });

    for (const right of rightCandidates) {
      const rightHeaderIndex = right.rows.findIndex((row) => isRightHeader(row.texts));
      const rightHeaders = right.rows[rightHeaderIndex].texts;
      const rp = {
        hits: indexOfHeader(rightHeaders, ["安打", "被安打"]),
        walks: indexOfHeader(rightHeaders, ["四球", "与四球"]),
        hitByPitch: indexOfHeader(rightHeaders, ["死球", "与死球"]),
        strikeouts: indexOfHeader(rightHeaders, ["三振", "奪三振"]),
        runs: indexOfHeader(rightHeaders, ["失点"]),
        earnedRuns: indexOfHeader(rightHeaders, ["自責点", "自責"]),
      };
      if (Object.values(rp).some((position) => position < 0)) continue;

      const rightData = right.rows.slice(rightHeaderIndex + 1).filter((row) => {
        if (/チーム計/.test(row.texts.join(" "))) return false;
        return row.texts.filter((value) => /^-?\d+(?:\.\d+)?$/.test(value.trim())).length >= 6;
      });
      if (!rightData[playerRowIndex]) continue;

      const leftRow = leftData[playerRowIndex];
      const rightRow = rightData[playerRowIndex];
      const pitcherCell = leftRow.cells[lp.pitcher];
      const outs = inningsOuts(leftRow.texts[lp.innings]);
      if (!pitcherCell || outs <= 0 || outs > 36) continue;
      const decisionMark = leftRow.texts[0] || "";

      return {
        starterOriginalName: pitcherCell.text.trim(),
        playerCode: requestedPlayerCode,
        inningsOuts: outs,
        battersFaced: num(leftRow.texts[lp.batters]),
        hits: num(rightRow.texts[rp.hits]),
        walks: num(rightRow.texts[rp.walks]),
        hitByPitch: num(rightRow.texts[rp.hitByPitch]),
        strikeouts: num(rightRow.texts[rp.strikeouts]),
        earnedRuns: num(rightRow.texts[rp.earnedRuns]),
        runs: num(rightRow.texts[rp.runs]),
        decision: /○|勝/.test(decisionMark) ? "승" : /●|敗/.test(decisionMark) ? "패" : "-",
        pitches: num(leftRow.texts[lp.pitches]) || null,
      };
    }
  }

  return null;
}

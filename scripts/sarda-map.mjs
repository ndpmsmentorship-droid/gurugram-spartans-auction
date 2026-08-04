// Shared mapping from the Sarda league API player shape to scout_players.

export const n = (v) => {
  if (v == null || v === "" || v === "blank") return null;
  const x = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
};

export function oversToBalls(o) {
  if (o == null) return null;
  const whole = Math.floor(o);
  const balls = Math.round((o - whole) * 10);
  return balls > 5 ? null : whole * 6 + balls;
}

export function mapPlayer(p) {
  const role = p.playingAs && p.playingAs !== "blank" ? p.playingAs : p.skill || null;
  const isKeeper =
    String(p.skill) === "WICKET_KEEPER" || /keep/i.test(String(p.playingAs || ""));

  let wickets = n(p.Wickets);
  const balls = oversToBalls(n(p.overs));
  if (wickets != null && balls != null && wickets > balls) wickets = null;

  return {
    full_name: String(p.Name || "").trim(),
    age: n(p.age) != null ? Math.round(n(p.age)) : null,
    primary_role: role,
    photo_url: p["Player Image"] || null,
    cricheroes_link: p["Cric Heroes Profile"] || null,
    is_keeper: isKeeper,
    bat_matches: n(p.batting_matches),
    bat_innings: n(p.batting_innings),
    not_out: n(p.not_out),
    runs: n(p.batting_runs),
    highest_score: p.highest_runs != null ? String(p.highest_runs) : null,
    bat_avg: n(p["Batting Avg"]),
    bat_sr: n(p["Batting SR"]),
    fifties: n(p["50s"]),
    hundreds: n(p["100s"]),
    fours: n(p.bating_4s),
    sixes: n(p.bating_6s),
    ducks: n(p.ducks),
    bowl_matches: n(p.bowling_matches),
    bowl_innings: n(p.bowling_innings),
    overs: n(p.overs),
    maidens: n(p.maidens),
    wickets,
    bowl_runs: n(p.bowling_runs),
    economy: n(p.Economy),
    bowl_avg: n(p.bowling_avg),
    bowl_sr: n(p.bowling_sr),
    three_w: n(p["3_wickets"]),
    five_w: n(p["5_wickets"]),
    dot_balls: n(p.dot_balls),
    bowl_fours: n(p.bowling_4s),
    bowl_sixes: n(p.bowling_6s),
    wides: n(p.wides),
    noballs: n(p.noballs),
    catches: n(p.Catches),
    run_outs: n(p["Run outs"]),
    stumpings: n(p.Stumpings),
    keeping_catches: n(p["Caught behind"]),
  };
}

export function toRaw(r) {
  return {
    bat_matches: r.bat_matches, bat_innings: r.bat_innings, not_out: r.not_out,
    runs: r.runs, bat_avg: r.bat_avg, bat_sr: r.bat_sr, fifties: r.fifties,
    hundreds: r.hundreds, fours: r.fours, sixes: r.sixes,
    bowl_matches: r.bowl_matches, overs: r.overs, wickets: r.wickets,
    economy: r.economy, bowl_avg: r.bowl_avg, bowl_sr: r.bowl_sr,
    dot_balls: r.dot_balls, bowl_fours: r.bowl_fours, bowl_sixes: r.bowl_sixes,
    five_w: r.five_w, catches: r.catches,
    run_outs: r.run_outs, is_keeper: r.is_keeper, stumpings: r.stumpings,
    keeping_catches: r.keeping_catches, primary_role: r.primary_role,
  };
}

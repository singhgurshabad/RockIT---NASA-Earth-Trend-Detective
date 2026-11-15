import { statusLabel, unitLabel, windowLabel } from "@/lib/format";
import type { ApiGlossaryEntry, ApiMeta, ApiVariable } from "@/lib/types";
import Icon from "./Icon";

const METHOD_TITLES: [string, string][] = [
  ["trend", "Trend"],
  ["multiple_testing", "Supported or inconclusive"],
  ["anomaly", "Anomalies"],
  ["fingerprint", "Fingerprints"],
  ["twins", "Earth Twins"],
  ["clusters", "Groups"],
];

/** Where the numbers come from, how they were made, and what they cannot tell you. All text comes from /api/meta. */
export default function Method({ meta, variables, glossary }: { meta: ApiMeta; variables: ApiVariable[]; glossary: ApiGlossaryEntry[] }) {
  const d = meta.dataset;
  return (
    <section id="method" className="page-head pb-16" aria-labelledby="method-heading">
      <div className="page">
        <h1 id="method-heading" className="text-[clamp(28px,3vw,40px)]">Method and data</h1>
        <p className="section-lede">
          Everything on this page is computed from one dataset by one documented analysis run. Here is what that means and where it stops.
        </p>

        <div className="mt-8 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-[18px]">The data</h3>
            <p className="mt-3 text-ink-2">
              <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a>, {windowLabel(meta.period.start, meta.period.end)} ({d.granules} monthly files).
            </p>
            <p className="mt-2 text-ink-2">{d.kind}</p>
            <p className="mt-2 text-ink-2">
              Each region&apos;s monthly value is the mean of the GLDAS grid cells inside its outline, weighted by how much of each cell the outline covers.{" "}
              {meta.completeness.values_missing === 0
                ? `All ${meta.completeness.values_expected.toLocaleString("en-US")} monthly values (${meta.completeness.series} series) are present.`
                : `${meta.completeness.values_missing.toLocaleString("en-US")} of ${meta.completeness.values_expected.toLocaleString("en-US")} monthly values are missing and are left as gaps.`}{" "}
              Nothing is interpolated or filled in.
            </p>
            <div className="mt-4 overflow-x-auto">
            <table className="data-table min-w-[420px]">
              <thead>
                <tr><th scope="col">Variable</th><th scope="col">GLDAS field</th><th scope="col">Shown in</th><th scope="col">Conversion</th></tr>
              </thead>
              <tbody>
                {variables.map((v) => (
                  <tr key={v.id}>
                    <th scope="row" className="border-b border-line px-3 py-2 text-left align-top font-medium">{v.label}</th>
                    <td className="text-ink-2">{v.gldas_field}</td>
                    <td className="whitespace-nowrap text-ink-2">{unitLabel(v.unit)}</td>
                    <td className="text-ink-2">{d.unit_conversions[v.id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <p className="mt-3 text-[13px] text-ink-3">{d.citation}</p>

            <h3 className="mt-9 text-[18px]">Status</h3>
            <p className="mt-3 flex items-start gap-2.5 text-ink-2">
              <Icon name="alert" className="mt-0.5 flex-none text-review" />
              <span>
                {statusLabel(meta.review_status)}. The trend method passed the team&apos;s self-tests and the grouping {statusLabel(meta.model_status).toLowerCase()}, but no scientist has signed off on these results. Treat them as exploration.
              </span>
            </p>
            {meta.review_notes.map((note) => (
              <div key={note.id} className="note note-review mt-4">
                <p className="font-medium text-ink">{note.title}</p>
                <p className="mt-1">{note.note}</p>
                <p className="mt-1.5 text-[12.5px] text-ink-3">
                  {note.raised_by ? `Raised by ${note.raised_by}. ` : ""}
                  {note.source_url && <a href={note.source_url} target="_blank" rel="noreferrer">NASA product page</a>}
                </p>
              </div>
            ))}

            <h3 className="mt-9 text-[18px]">Limits</h3>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ink-2">
              {meta.limitations.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="text-[18px]">How the numbers are made</h3>
            <dl className="mt-3 flex flex-col gap-4">
              {METHOD_TITLES.filter(([key]) => meta.methods[key]).map(([key, title]) => (
                <div key={key}>
                  <dt className="font-medium text-ink">{title}</dt>
                  <dd className="mt-1 text-ink-2">{meta.methods[key]}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-9 text-[18px]">Region outlines</h3>
            <ul className="mt-3 flex flex-col gap-2 text-ink-2">
              {meta.boundary_sources.map((s) => (
                <li key={s.name}>
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}
                  {s.license ? `, ${s.license}` : ""}
                  {s.citation ? `. ${s.citation}` : ""}
                  <span className="text-ink-3"> ({s.regions?.length ?? 0} {s.regions?.length === 1 ? "region" : "regions"})</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-ink-3">
              The globe draws simplified copies of these outlines. The analysis used the full-resolution shapes. Globe imagery: NASA Blue Marble via GIBS, with Natural Earth outlines underneath. The imagery is a backdrop only; it is not part of the analysis.
            </p>

            <h3 className="mt-9 text-[18px]">Reproducing this</h3>
            <dl className="num mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13.5px] text-ink-2">
              <dt className="text-ink-3">Analysis run</dt><dd className="break-all">{meta.run_id}</dd>
              <dt className="text-ink-3">Input checksum</dt><dd className="break-all">{d.input_sha256 ?? "not recorded"}</dd>
              <dt className="text-ink-3">Notebook</dt><dd>analysis/RockIT_Analysis_Training_Final.ipynb</dd>
              <dt className="text-ink-3">Libraries</dt><dd>{Object.entries(meta.packages).map(([name, version]) => `${name} ${version}`).join(", ")}</dd>
            </dl>
          </div>
        </div>

        <details className="mt-10 border-t border-line pt-5">
          <summary className="cursor-pointer text-[18px] font-semibold" style={{ fontStretch: "116%" }}>Glossary ({glossary.length} terms)</summary>
          {glossary.length === 0 ? (
            <p className="mt-3 text-ink-2">The glossary could not be loaded.</p>
          ) : (
            <dl className="mt-4 grid gap-x-12 gap-y-5 md:grid-cols-2">
              {glossary.map((entry) => (
                <div key={entry.id}>
                  <dt className="font-medium text-ink">{entry.term}</dt>
                  <dd className="mt-1 text-ink-2">{entry.definition}</dd>
                  {entry.explanation && <dd className="mt-1 text-[13.5px] text-ink-3">{entry.explanation}</dd>}
                </div>
              ))}
            </dl>
          )}
        </details>
      </div>
    </section>
  );
}

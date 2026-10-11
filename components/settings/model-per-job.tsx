import { DRAFT_MODEL, DRAFT_PROMPT_VERSION, SCORE_VERSION } from "@/lib/requirements/config"
import { MODEL, PROMPT_VERSION } from "@/lib/simulate"
import { RESEARCH_PROMPT_VERSION } from "@/lib/research"

// Which model and prompt version each job actually uses — straight from the code, not from a form.
const JOBS: { job: string; model: string; prompt: string }[] = [
  { job: "What-If Studio", model: MODEL, prompt: PROMPT_VERSION },
  { job: "Research Agent", model: MODEL, prompt: RESEARCH_PROMPT_VERSION },
  { job: "Requirements drafting", model: DRAFT_MODEL, prompt: DRAFT_PROMPT_VERSION },
  { job: "Scoring", model: "No AI: code", prompt: SCORE_VERSION },
]

export function ModelPerJob() {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Job</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Prompt version</th>
          </tr>
        </thead>
        <tbody>
          {JOBS.map((j) => (
            <tr key={j.job} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2">{j.job}</td>
              <td className="px-3 py-2 font-mono text-xs">{j.model}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{j.prompt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

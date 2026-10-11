import { History as HistoryIcon } from "lucide-react"

import { EmptyState, PageHeader } from "@/components/page"
import { Card, CardContent } from "@/components/ui/card"

export default function History() {
  return (
    <>
      <PageHeader
        title="History"
        description="Every what-if, research run and decision, with the exact evidence, model and time. Reopen anything as it was."
      />
      <Card>
        <CardContent>
          <EmptyState icon={HistoryIcon} title="Nothing logged yet" className="py-16">
            This is the audit trail for decision gates. Entries are append-only and never edited.
          </EmptyState>
        </CardContent>
      </Card>
    </>
  )
}

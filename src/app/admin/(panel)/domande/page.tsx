import { QuestionsManager } from "@/components/admin/QuestionsManager";
import { getRomeDateString } from "@/lib/date";
import { listQuestions } from "@/lib/services/questions";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const questions = await listQuestions();
  return (
    <div className="animate-fade-up">
      <QuestionsManager questions={questions} today={getRomeDateString()} />
    </div>
  );
}

import { Link } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/Feedback";

export function NotFoundPage(): JSX.Element {
  usePageTitle("Not found");
  return (
    <div>
      <PageHeader title="Not found" />
      <EmptyState
        icon="alert"
        title="Page not found"
        description="This page does not exist or the data was reset."
        action={
          <Link to="/today" className="btn btn--primary">
            Return to Today
          </Link>
        }
      />
    </div>
  );
}

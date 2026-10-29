import { statuses } from "../../lib/constants";
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status.toLowerCase()}`}>
      {statuses[status] || status}
    </span>
  );
}

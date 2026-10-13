import { RoleGate } from "@/features/access/RoleGate";
import { WorkshopExperience } from "@/features/workshops/WorkshopExperience";

export default function WorkshopsPage() {
  return (
    <RoleGate allow={["ADMIN", "STUDENT"]}>
      <WorkshopExperience />
    </RoleGate>
  );
}

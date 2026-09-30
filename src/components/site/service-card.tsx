import type { LucideIcon } from "lucide-react";

type ServiceCardProps = {
  description: string;
  icon: LucideIcon;
  title: string;
};

export function ServiceCard({ description, icon: Icon, title }: ServiceCardProps) {
  return (
    <article className="service-card">
      <span aria-hidden="true" className="service-icon">
        <Icon />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

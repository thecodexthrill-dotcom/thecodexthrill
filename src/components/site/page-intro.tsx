import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
};

export function PageIntro({ eyebrow, title, description }: PageIntroProps) {
  return (
    <section className="page-intro container-shell">
      <p className="eyebrow"><span />{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-intro-description">{description}</p>
    </section>
  );
}

import {
  BrainCircuit,
  Cloud,
  Code2,
  Layers3,
  Smartphone,
  Workflow,
} from "lucide-react";

export const services = [
  {
    slug: "web-applications",
    title: "Web applications",
    short: "Thoughtful web products built around real workflows.",
    description:
      "Bring product direction, accessible interface design, and dependable engineering together in a web experience shaped around the people who use it.",
    icon: Code2,
  },
  {
    slug: "mobile-products",
    title: "Mobile products",
    short: "Focused mobile experiences for everyday use.",
    description:
      "Create clear, useful mobile experiences with considered interaction patterns and foundations that support future change.",
    icon: Smartphone,
  },
  {
    slug: "ai-solutions",
    title: "AI solutions",
    short: "Applied AI that serves a clear user need.",
    description:
      "Explore where AI can help, make limitations understandable, and keep people in control of consequential decisions.",
    icon: BrainCircuit,
  },
  {
    slug: "saas-platforms",
    title: "SaaS platforms",
    short: "Flexible product foundations for evolving needs.",
    description:
      "Shape a SaaS product around clear customer workflows, maintainable engineering, and room to learn as needs change.",
    icon: Layers3,
  },
  {
    slug: "cloud-devops",
    title: "Cloud & DevOps",
    short: "Delivery foundations that support confident releases.",
    description:
      "Make deployment, operations, and system behavior easier to understand with delivery practices designed for the team and product.",
    icon: Cloud,
  },
  {
    slug: "enterprise-software",
    title: "Enterprise software",
    short: "Connected tools for complex organizational work.",
    description:
      "Improve complex workflows with integrated applications shaped around real operating needs, clear ownership, and dependable access controls.",
    icon: Workflow,
  },
] as const;

export const articles = [
  {
    slug: "start-with-the-workflow",
    category: "Product thinking",
    title: "Start with the workflow, not the feature list",
    excerpt:
      "A practical way to turn a broad product idea into a clearer first release.",
    readingTime: "5 min read",
    body: [
      "Feature lists are easy to collect and difficult to prioritize. A workflow gives a team a more useful starting point: what someone is trying to do, what gets in the way, and what a better outcome looks like.",
      "Map the steps people take today, including handoffs and workarounds. Then identify the smallest change that can make one meaningful part of that journey easier to complete.",
      "This approach keeps early product decisions connected to observable needs. It also gives design and engineering a shared problem to solve before implementation begins.",
    ],
  },
  {
    slug: "make-ai-useful-and-clear",
    category: "Engineering",
    title: "Make AI useful, understandable, and reviewable",
    excerpt:
      "Questions to ask before adding an AI capability to a digital product.",
    readingTime: "6 min read",
    body: [
      "A model capability is not a product outcome. Start by naming the user problem and comparing an AI approach with simpler ways to solve it.",
      "When AI is useful, make its role clear. Show what the system can and cannot do, offer a way to review important outputs, and provide a safe path when confidence is low.",
      "Treat evaluation as ongoing product work. Test representative inputs, monitor failure patterns, and keep a human decision-maker involved where the consequences require it.",
    ],
  },
  {
    slug: "design-for-the-next-change",
    category: "Product thinking",
    title: "Build a foundation that can absorb the next change",
    excerpt:
      "Good architecture keeps change possible without making every decision abstract.",
    readingTime: "4 min read",
    body: [
      "A useful foundation fits the product that exists today and leaves sensible room for likely changes. It does not require predicting every future feature.",
      "Keep boundaries clear around areas that change for different reasons. Prefer explicit contracts and simple shared patterns over a generalized framework without a current need.",
      "Review the cost of flexibility as well as its benefit. The best structure is one the team can understand, operate, and adapt as evidence arrives.",
    ],
  },
] as const;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/lib/usePageTitle";
import { useActions } from "@/state/store-context";
import { Button } from "@/components/primitives/Button";
import { ArchitectArt } from "@/components/ArchitectArt";

interface Panel {
  title: string;
  body: string;
}

const PANELS: Panel[] = [
  {
    title: "A system for a better you",
    body: "Set your commitments. Track your time. Build the life you said you would.",
  },
  {
    title: "Your time. Your rules.",
    body: "Create commitments, track with a timer, and keep a permanent record of what happened.",
  },
  {
    title: "Small steps. Big results.",
    body: "Consistency compounds over time. Plan, execute, record, repeat.",
  },
];

export function WelcomePage(): JSX.Element {
  usePageTitle("Welcome");
  const [index, setIndex] = useState(0);
  const actions = useActions();
  const navigate = useNavigate();
  const panel = PANELS[index]!;
  const isLast = index === PANELS.length - 1;

  const finish = async (): Promise<void> => {
    await actions.updateSettings({ onboardingCompleted: true });
    navigate("/today", { replace: true });
  };

  return (
    <div className="onboarding blueprint-bg">
      <div className="onboarding__body">
        <ArchitectArt />
        <div className="stack gap-3">
          <h1 className="onboarding__title">{panel.title}</h1>
          <p className="muted">{panel.body}</p>
        </div>
        <div className="onboarding__dots" aria-hidden="true">
          {PANELS.map((_, i) => (
            <span key={i} className="onboarding__dot" data-active={i === index} />
          ))}
        </div>
      </div>
      <div className="onboarding__footer">
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => (isLast ? void finish() : setIndex((i) => i + 1))}
        >
          {isLast ? "Get started" : "Continue"}
        </Button>
        <Button variant="quiet" onClick={() => void finish()}>
          Skip
        </Button>
      </div>
    </div>
  );
}

import { WorkspaceView } from "../../../components/views";
import { DesktopRuntimeSetup } from "../../../components/desktop/desktop-runtime-setup";

export default function Page() {
  return <div className="mx-auto max-w-6xl py-5">
    <WorkspaceView title="Settings" eyebrow="CONTROL CENTER" description="Tune the JVerse experience around your workflow." actionLabel="Ask setup assistant" actionPrompt="Help me configure my JVerse workspace and local AI runtime. Ask which component I need help with." />
    <div id="desktop-runtime" className="scroll-mt-6"><DesktopRuntimeSetup /></div>
  </div>;
}

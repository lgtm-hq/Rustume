import { Suspense, createMemo, lazy } from "solid-js";
import { CommandPalette, type CommandAction } from "../components/ui";
import { useHotkeys, type Shortcut } from "../hooks/useHotkeys";
import { usePageTitle } from "../hooks/usePageTitle";
import { HomeLayout } from "../lib/homeLayout";
import { uiStore } from "../stores/ui";
import { HomePageLayout } from "./home/HomeLayouts";
import { useHomePage } from "./home/useHomePage";

const ImportModal = lazy(() =>
  import("../components/import/ImportModal").then((module) => ({ default: module.ImportModal })),
);

export default function Home() {
  usePageTitle("Your resumes");
  const home = useHomePage();
  const { openModal } = uiStore;

  const shortcuts: Shortcut[] = [
    {
      key: "k",
      mod: true,
      handler: () => openModal("commandPalette"),
      label: "Command palette",
      category: "General",
    },
    { key: "n", handler: () => home.handleNew(), label: "New resume", category: "Library" },
    { key: "i", handler: () => home.handleImport(), label: "Import resume", category: "Library" },
    { key: "s", handler: () => void home.refresh(), label: "Sync now", category: "Library" },
    {
      key: "1",
      handler: () => home.setLayout(HomeLayout.List),
      label: "List view",
      category: "View",
    },
    {
      key: "2",
      handler: () => home.setLayout(HomeLayout.Grid),
      label: "Grid view",
      category: "View",
    },
    {
      key: "3",
      handler: () => home.setLayout(HomeLayout.Gallery),
      label: "Gallery view",
      category: "View",
    },
  ];

  useHotkeys(shortcuts);

  const commandActions = createMemo<CommandAction[]>(() => [
    {
      id: "home:new",
      label: "New resume",
      group: "Actions",
      shortcut: "N",
      keywords: "create add resume",
      handler: () => home.handleNew(),
    },
    {
      id: "home:import",
      label: "Import resume",
      group: "Actions",
      shortcut: "I",
      keywords: "upload json open file",
      handler: () => home.handleImport(),
    },
    {
      id: "home:sync",
      label: "Sync now",
      group: "Actions",
      shortcut: "S",
      keywords: "refresh reload library",
      handler: () => void home.refresh(),
    },
    {
      id: "home:view-list",
      label: "Switch to List view",
      group: "View",
      shortcut: "1",
      keywords: "layout rows density",
      handler: () => home.setLayout(HomeLayout.List),
    },
    {
      id: "home:view-grid",
      label: "Switch to Grid view",
      group: "View",
      shortcut: "2",
      keywords: "layout cards density",
      handler: () => home.setLayout(HomeLayout.Grid),
    },
    {
      id: "home:view-gallery",
      label: "Switch to Gallery view",
      group: "View",
      shortcut: "3",
      keywords: "layout thumbnails previews density",
      handler: () => home.setLayout(HomeLayout.Gallery),
    },
  ]);

  return (
    <>
      <HomePageLayout home={home} />

      <CommandPalette actions={commandActions()} />

      <Suspense fallback={null}>
        <ImportModal createAndOpen />
      </Suspense>
    </>
  );
}

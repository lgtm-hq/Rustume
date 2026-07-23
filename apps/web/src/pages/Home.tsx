import { Suspense, lazy } from "solid-js";
import { usePageTitle } from "../hooks/usePageTitle";
import { HomePageLayout } from "./home/HomeLayouts";
import { useHomePage } from "./home/useHomePage";

const ImportModal = lazy(() =>
  import("../components/import/ImportModal").then((module) => ({ default: module.ImportModal })),
);

export default function Home() {
  usePageTitle("Your resumes");
  const home = useHomePage();

  return (
    <>
      <HomePageLayout home={home} />

      <Suspense fallback={null}>
        <ImportModal createAndOpen />
      </Suspense>
    </>
  );
}

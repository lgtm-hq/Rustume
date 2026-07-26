import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import App from "./App";
import "./index.css";

const Home = lazy(() => import("./pages/Home"));
const Editor = lazy(() => import("./pages/Editor"));
const Account = lazy(() => import("./pages/Account"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DesignLabIndex = lazy(() => import("./pages/design-lab/DesignLabIndex"));
const HomeWorkspace = lazy(() => import("./pages/design-lab/HomeWorkspace"));
const HomePlate = lazy(() => import("./pages/design-lab/HomePlate"));
const HomeAether = lazy(() => import("./pages/design-lab/HomeAether"));
const HomeProof = lazy(() => import("./pages/design-lab/HomeProof"));
const HomeNest = lazy(() => import("./pages/design-lab/HomeNest"));

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

render(
  () => (
    <Router root={App}>
      <Route path="/" component={Home} />
      <Route path="/account" component={Account} />
      <Route path={["/terms", "/terms/"]} component={Terms} />
      <Route path={["/privacy", "/privacy/"]} component={Privacy} />
      <Route path="/edit/:id" component={Editor} />
      <Route path="/design-lab" component={DesignLabIndex} />
      <Route path="/design-lab/home/workspace" component={HomeWorkspace} />
      <Route path="/design-lab/home/plate" component={HomePlate} />
      <Route path="/design-lab/home/aether" component={HomeAether} />
      <Route path="/design-lab/home/proof" component={HomeProof} />
      <Route path="/design-lab/home/nest" component={HomeNest} />
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  root,
);

import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import App from "./App";
import { resolveEditRoute } from "./pages/editRoute";
import "./index.css";

const Home = lazy(() => import("./pages/Home"));
const Account = lazy(() => import("./pages/Account"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** The form editor or the flag-gated document sheet — decided once, at startup. */
const EditRoute = resolveEditRoute();

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
      <Route path="/edit/:id" component={EditRoute} />
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  root,
);

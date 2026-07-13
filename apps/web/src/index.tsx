import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import App from "./App";
import "./index.css";

const Home = lazy(() => import("./pages/Home"));
const Editor = lazy(() => import("./pages/Editor"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicResume = lazy(() => import("./pages/PublicResume"));

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

render(
  () => (
    <Router root={App}>
      <Route path="/" component={Home} />
      <Route path="/account" component={Account} />
      <Route path="/r/:slug" component={PublicResume} />
      <Route path="/edit/:id" component={Editor} />
      <Route path="*404" component={NotFound} />
    </Router>
  ),
  root,
);

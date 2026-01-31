import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import App from "./App";
import "./index.css";

const Home = lazy(() => import("./pages/Home"));
const Editor = lazy(() => import("./pages/Editor"));

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

render(
  () => (
    <Router root={App}>
      <Route path="/" component={Home} />
      <Route path="/edit/:id" component={Editor} />
    </Router>
  ),
  root
);

import { type ParentComponent } from "solid-js";
import { I18nProvider } from "../i18n";

/** Wrap component tests with the default en-US locale catalog. */
export const I18nTestProvider: ParentComponent = (props) => {
  return <I18nProvider>{props.children}</I18nProvider>;
};

import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { App } from "./app/app";
import { routes } from "./app/app.routes";

bootstrapApplication(App, { providers: [provideRouter(routes)] }).catch(console.error);

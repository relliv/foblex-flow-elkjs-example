import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

const bootstrap = (context?: any) => {
  if (context) {
    return bootstrapApplication(AppComponent, { ...config, ...context });
  }
  return bootstrapApplication(AppComponent, config);
};

export default bootstrap;

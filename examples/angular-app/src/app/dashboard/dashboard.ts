import { Component } from "@angular/core";

/** A stand-in for your app's own pages. No Prismatic code here. */
@Component({
  template: `
    <h2>Dashboard</h2>
    <div class="cards">
      @for (stat of stats; track stat.label) {
        <div class="card">
          <small>{{ stat.label }}</small>
          <strong>{{ stat.value }}</strong>
        </div>
      }
    </div>
    <p>Open an integrations page in the sidebar to see Prismatic embedded in this app.</p>
  `,
})
export class Dashboard {
  protected readonly stats = [
    { label: "Open leads", value: 128 },
    { label: "Deals won", value: 42 },
    { label: "Revenue", value: "$86,400" },
  ];
}

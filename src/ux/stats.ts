import {LitElement, PropertyValues, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import { Statistics } from '..';

@customElement('ux-stats')
export class UxStats extends LitElement {
  // Define scoped styles right with your component, in plain CSS
  static styles = css`
    :host {
      color: white;
      position: absolute
    }
  `;

  @property() statistics?: Statistics;

  // Render the UI as a function of component state
  render() {
    return html`
      <div>FPS: ${Math.round(this.statistics?.fps)}</div>
      <div>Mesh ms: ${Math.round(this.statistics?.meshGeneration)}</div>
      <div>Vertices: ${this.statistics?.vertices}</div>
    `;
  }
}
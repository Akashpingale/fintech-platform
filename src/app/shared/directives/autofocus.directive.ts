import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/**
 * Moves keyboard focus to the host element once it is rendered — used for the
 * first field of a dialog or form so keyboard users do not have to tab in.
 */
@Directive({ selector: '[appAutofocus]', standalone: true })
export class AutofocusDirective implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    // Deferred a frame so Material's own focus handling runs first.
    requestAnimationFrame(() => this.el.nativeElement.focus());
  }
}

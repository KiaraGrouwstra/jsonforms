import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllIds, createAjv } from '@jsonforms/core';
import { JsonForms } from '@jsonforms/vue';
import { mount } from '@vue/test-utils';
import { markRaw, defineComponent, h } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { VApp } from 'vuetify/components';
import { extendedVuetifyRenderers } from '../../../src';

global.ResizeObserver = require('resize-observer-polyfill');

const vuetify = createVuetify({ components, directives });

// Regression for the additional-properties (map) renderer handing the WRONG AJV
// to the nested `json-forms` it mounts for the new-property-name input.
//
// The renderer must reuse the PARENT form's AJV (via `useAjv`, i.e.
// `jsonforms.core.ajv`), not a fresh default one. This matters whenever the
// parent AJV is configured differently from the default -- here, with
// `unicodeRegExp: false`. AJV enables the `u` flag on `pattern` by default,
// which is STRICTER than the JSON Schema spec (spec `pattern` is ECMAScript
// regex without `u`). A `propertyNames` pattern that is valid without `u` but a
// syntax error with it (a raw brace in a lookahead, as nixpkgs' `attrName` key
// type emits) then throws inside the nested form's own default AJV -- but only
// there, because the parent (correctly configured) compiled it fine.
//
// Before the fix the nested form received `ajv: undefined` (read off the wrong
// context level) and built its own default-`u` AJV, so mounting this map threw
// `Lone quantifier brackets` and the form failed to render.
describe('AdditionalProperties nested AJV', () => {
  // A map whose KEY type carries a `pattern` legal without the `u` flag but a
  // syntax error with it.
  const schema = {
    type: 'object' as const,
    properties: {
      secretFiles: {
        type: 'object' as const,
        additionalProperties: { type: 'string' as const },
        propertyNames: {
          pattern: '^"([^"$\\\\]|\\$(?!{)|\\\\.)*"$',
        },
      },
    },
  };
  const uischema = { type: 'Control' as const, scope: '#' };

  // A parent form configured with `unicodeRegExp: false` -- so the schema's
  // pattern compiles at the parent, and only a MIS-configured nested form would
  // throw.
  const ParentForm = defineComponent({
    setup() {
      const ajv = markRaw(createAjv({ unicodeRegExp: false }));
      return () =>
        h(VApp, () =>
          h(JsonForms, {
            data: { secretFiles: {} },
            schema,
            uischema,
            renderers: markRaw(extendedVuetifyRenderers),
            ajv,
            onChange: () => undefined,
          }),
        );
    },
  });

  beforeEach(() => {
    clearAllIds();
  });

  it('mounts a map whose key pattern is only valid without the `u` flag', () => {
    expect(() =>
      mount(ParentForm, {
        global: { plugins: [vuetify] },
        attachTo: document.body,
      }),
    ).not.toThrow();
  });
});

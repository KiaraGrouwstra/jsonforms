import { describe, it, expect, beforeEach } from 'vitest';
import { clearAllIds } from '@jsonforms/core';
import { JsonForms } from '@jsonforms/vue';
import { mount } from '@vue/test-utils';
import { defineComponent, h, markRaw } from 'vue';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { VApp } from 'vuetify/components';
import { extendedVuetifyRenderers } from '../../../src';

global.ResizeObserver = require('resize-observer-polyfill');

const vuetify = createVuetify({ components, directives });

// Regression for the additional-properties (map) renderer building the nested
// new-property-name form's schema from `propertyNames` WITHOUT resolving a
// `$ref` on it first.
//
// `propertyNames` commonly points into the root's `$defs` -- the shape emitted
// by generators that share a named key type across many maps. The renderer
// mounts that schema as the nested `json-forms`' OWN root, where `#/$defs/...`
// does not exist, so AJV throws `can't resolve reference #/$defs/... from id #`
// and the map fails to render. The renderer must resolve the `$ref` against the
// real root schema before handing the subschema down.
describe('AdditionalProperties nested $ref propertyNames', () => {
  // A map whose KEY type is a `$ref` into the root `$defs` rather than an inline
  // schema -- exactly what a shared named key type emits.
  const schema = {
    type: 'object' as const,
    $defs: {
      attrName: {
        type: 'string' as const,
        pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
      },
    },
    properties: {
      secretFiles: {
        type: 'object' as const,
        additionalProperties: { type: 'string' as const },
        propertyNames: { $ref: '#/$defs/attrName' },
      },
    },
  };
  const uischema = { type: 'Control' as const, scope: '#' };

  const ParentForm = defineComponent({
    setup() {
      return () =>
        h(VApp, () =>
          h(JsonForms, {
            data: { secretFiles: {} },
            schema,
            uischema,
            renderers: markRaw(extendedVuetifyRenderers),
            onChange: () => undefined,
          }),
        );
    },
  });

  beforeEach(() => {
    clearAllIds();
  });

  it('mounts a map whose key type is a `$ref` into the root `$defs`', () => {
    expect(() =>
      mount(ParentForm, {
        global: { plugins: [vuetify] },
        attachTo: document.body,
      }),
    ).not.toThrow();
  });
});

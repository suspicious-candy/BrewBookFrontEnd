import { Platform, Text, TextInput } from 'react-native';

// Mirrors the typography used on the Login / Create Account screens:
// serif for brand-name / title elements, monospace for everything else.
export const FONT_SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
export const FONT_MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// Apply mono + a slightly heavier weight as the base for every <Text> and
// <TextInput> in the app. We override `.render` (instead of `defaultProps`)
// so the base styles get merged in even when callers pass their own `style`.
let applied = false;
export function applyGlobalFontDefaults() {
  if (applied) return;
  applied = true;

  const base = { fontFamily: FONT_MONO, fontWeight: '500' };

  const wrapRender = (Component) => {
    const original = Component.render;
    if (!original) return;
    Component.render = function (...args) {
      const [props, ref] = args;
      const merged = {
        ...props,
        style: [base, props?.style],
      };
      return original.call(this, merged, ref);
    };
  };

  wrapRender(Text);
  wrapRender(TextInput);
}

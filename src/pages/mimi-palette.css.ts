import tokens from '../../design/tokens.json';

export function GET() {
  const colors = (palette: Record<string, string>) =>
    Object.entries(palette).map(([name, value]) => `--mimi-${name}:${value}`);
  const base = [
    ...colors(tokens.color),
    ...Object.entries(tokens.motion).map(([name, ms]) => `--mimi-motion-${name}:${ms}ms`),
    ...(['space', 'radius', 'type'] as const).flatMap(group =>
      Object.entries(tokens[group]).map(([name, px]) => `--mimi-${group}-${name}:${px / 16}rem`)),
    `--mimi-target:${tokens.target / 16}rem`,
  ];
  const css = `:root{color-scheme:light;${base.join(';')}}:root[data-theme=dark]{color-scheme:dark;${colors(tokens.darkColor).join(';')}}`;
  return new Response(css, {headers: {'Content-Type': 'text/css; charset=utf-8'}});
}

/**
 * Safe Mathematical Parser & Calculator + Unit Converter
 * ZERO eval() or Function() constructor calls.
 */

// Tokenizer
function tokenize(input) {
  const tokens = [];
  let i = 0;
  const str = input.trim();

  // Normalize Unicode multiplication, division, power
  const normalized = str
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/π/g, 'pi');

  while (i < normalized.length) {
    const ch = normalized[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number (including decimals)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(normalized[i + 1] || ''))) {
      let numStr = '';
      while (i < normalized.length && /[0-9.]/.test(normalized[i])) {
        numStr += normalized[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
      continue;
    }

    // Identifiers (functions, constants, words like 'of', 'deg', 'rad')
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < normalized.length && /[a-zA-Z0-9_]/.test(normalized[i])) {
        id += normalized[i];
        i++;
      }
      tokens.push({ type: 'IDENT', value: id.toLowerCase() });
      continue;
    }

    // Two-character operators
    const next2 = normalized.slice(i, i + 2);
    if (['<=', '>=', '==', '!='].includes(next2)) {
      tokens.push({ type: 'OP', value: next2 });
      i += 2;
      continue;
    }

    // Single-character operators & punctuation
    if ('+-*/%^(),<>'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character in expression: '${ch}'`);
  }

  return tokens;
}

// Recursive Descent Parser
class SafeParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek() {
    return this.tokens[this.pos];
  }

  consume() {
    return this.tokens[this.pos++];
  }

  expect(type, value) {
    const t = this.peek();
    if (!t || t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error(`Expected ${value || type} but got ${t ? t.value : 'end of input'}`);
    }
    return this.consume();
  }

  parse() {
    const res = this.parseComparison();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at end of expression: ${this.peek().value}`);
    }
    return res;
  }

  parseComparison() {
    let left = this.parseAddSub();
    const t = this.peek();
    if (t && t.type === 'OP' && ['<', '>', '<=', '>=', '==', '!='].includes(t.value)) {
      const op = this.consume().value;
      const right = this.parseAddSub();
      switch (op) {
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
        case '==': return Math.abs(left - right) < 1e-12;
        case '!=': return Math.abs(left - right) >= 1e-12;
      }
    }
    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.pos < this.tokens.length) {
      const t = this.peek();
      if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
        const op = this.consume().value;
        const right = this.parseMulDiv();
        if (op === '+') left += right;
        else left -= right;
      } else {
        break;
      }
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parsePower();
    while (this.pos < this.tokens.length) {
      const t = this.peek();
      if (t && t.type === 'OP' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        const op = this.consume().value;
        const right = this.parsePower();
        if (op === '*') left *= right;
        else if (op === '/') {
          if (Math.abs(right) < 1e-15) throw new Error('Division by zero');
          left /= right;
        } else if (op === '%') {
          left %= right;
        }
      } else if (t && t.type === 'IDENT' && t.value === 'of') {
        // e.g. "15 % of 850" -> 15 * 850 / 100
        this.consume();
        const right = this.parsePower();
        left = (left / 100) * right;
      } else {
        break;
      }
    }
    return left;
  }

  parsePower() {
    let base = this.parseUnary();
    const t = this.peek();
    if (t && t.type === 'OP' && t.value === '^') {
      this.consume();
      const exp = this.parsePower(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }

  parseUnary() {
    const t = this.peek();
    if (t && t.type === 'OP' && (t.value === '+' || t.value === '-')) {
      const op = this.consume().value;
      const operand = this.parseUnary();
      return op === '-' ? -operand : operand;
    }
    return this.parsePrimary();
  }

  parsePrimary() {
    const t = this.peek();
    if (!t) throw new Error('Unexpected end of expression');

    if (t.type === 'NUMBER') {
      this.consume();
      // Handle trailing % (e.g., "15%")
      const next = this.peek();
      if (next && next.type === 'OP' && next.value === '%') {
        this.consume();
        // check if followed by 'of'
        const afterPercent = this.peek();
        if (afterPercent && afterPercent.type === 'IDENT' && afterPercent.value === 'of') {
          this.consume();
          const target = this.parsePower();
          return (t.value / 100) * target;
        }
        return t.value / 100;
      }
      return t.value;
    }

    if (t.type === 'OP' && t.value === '(') {
      this.consume();
      const val = this.parseComparison();
      this.expect('OP', ')');
      return val;
    }

    if (t.type === 'IDENT') {
      const name = this.consume().value;

      // Constants
      if (name === 'pi') return Math.PI;
      if (name === 'e') return Math.E;

      // Function call
      if (this.peek() && this.peek().type === 'OP' && this.peek().value === '(') {
        this.consume(); // '('
        const args = [];
        if (this.peek() && this.peek().type === 'OP' && this.peek().value === ')') {
          this.consume();
        } else {
          while (true) {
            args.push(this.parseComparison());
            const next = this.peek();
            if (next && next.type === 'OP' && next.value === ',') {
              this.consume();
            } else {
              break;
            }
          }
          this.expect('OP', ')');
        }

        return this.evalFunction(name, args);
      }

      throw new Error(`Unknown variable or identifier '${name}'`);
    }

    throw new Error(`Unexpected token '${t.value}'`);
  }

  evalFunction(name, args) {
    switch (name) {
      case 'sqrt':
        if (args.length !== 1) throw new Error('sqrt() takes 1 argument');
        if (args[0] < 0) throw new Error('sqrt() of negative number is not real');
        return Math.sqrt(args[0]);
      case 'cbrt':
        if (args.length !== 1) throw new Error('cbrt() takes 1 argument');
        return Math.cbrt(args[0]);
      case 'abs':
        if (args.length !== 1) throw new Error('abs() takes 1 argument');
        return Math.abs(args[0]);
      case 'round':
        if (args.length === 1) return Math.round(args[0]);
        if (args.length === 2) {
          const factor = Math.pow(10, args[1]);
          return Math.round(args[0] * factor) / factor;
        }
        throw new Error('round() takes 1 or 2 arguments');
      case 'floor':
        return Math.floor(args[0]);
      case 'ceil':
        return Math.ceil(args[0]);
      case 'sin':
        return Math.sin(args[0]);
      case 'cos':
        return Math.cos(args[0]);
      case 'tan':
        return Math.tan(args[0]);
      case 'asin':
        return Math.asin(args[0]);
      case 'acos':
        return Math.acos(args[0]);
      case 'atan':
        return Math.atan(args[0]);
      case 'log':
      case 'log10':
        return Math.log10(args[0]);
      case 'ln':
      case 'log_e':
        return Math.log(args[0]);
      case 'exp':
        return Math.exp(args[0]);
      case 'pow':
        if (args.length !== 2) throw new Error('pow() takes 2 arguments: (base, exp)');
        return Math.pow(args[0], args[1]);

      // Statistical functions
      case 'sum':
        if (args.length === 0) return 0;
        return args.reduce((a, b) => a + b, 0);
      case 'mean':
      case 'avg':
      case 'average': {
        if (args.length === 0) throw new Error('mean() requires at least 1 number');
        const sum = args.reduce((a, b) => a + b, 0);
        return sum / args.length;
      }
      case 'median': {
        if (args.length === 0) throw new Error('median() requires at least 1 number');
        const sorted = [...args].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      case 'mode': {
        if (args.length === 0) throw new Error('mode() requires numbers');
        const counts = {};
        let maxCount = 0;
        let modeVal = args[0];
        for (const num of args) {
          counts[num] = (counts[num] || 0) + 1;
          if (counts[num] > maxCount) {
            maxCount = counts[num];
            modeVal = num;
          }
        }
        return modeVal;
      }
      case 'min':
        return Math.min(...args);
      case 'max':
        return Math.max(...args);
      case 'std':
      case 'stdev': {
        if (args.length < 2) throw new Error('std() requires at least 2 numbers');
        const avg = args.reduce((a, b) => a + b, 0) / args.length;
        const variance = args.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / (args.length - 1);
        return Math.sqrt(variance);
      }
      default:
        throw new Error(`Unsupported math function: '${name}'`);
    }
  }
}

/**
 * Main safe calculator function
 */
export async function calculate(expression) {
  if (!expression || typeof expression !== 'string') {
    throw new Error('Please provide a valid mathematical expression string.');
  }

  try {
    const tokens = tokenize(expression);
    const parser = new SafeParser(tokens);
    const result = parser.parse();

    let formattedResult;
    if (typeof result === 'boolean') {
      formattedResult = result ? 'True' : 'False';
    } else if (Number.isInteger(result)) {
      formattedResult = result.toLocaleString('en-US');
    } else {
      // Precision limit for floating point
      formattedResult = parseFloat(result.toPrecision(12)).toString();
    }

    return {
      expression,
      result,
      formattedResult,
      type: typeof result
    };
  } catch (err) {
    return {
      expression,
      error: err.message,
      success: false
    };
  }
}

/**
 * Physical Unit Converter
 */
const UNIT_TABLE = {
  // Length (base: meters)
  length: {
    base: 'm',
    units: {
      m: 1,
      meter: 1,
      meters: 1,
      km: 1000,
      kilometer: 1000,
      kilometers: 1000,
      cm: 0.01,
      centimeter: 0.01,
      centimeters: 0.01,
      mm: 0.001,
      millimeter: 0.001,
      millimeters: 0.001,
      mi: 1609.344,
      mile: 1609.344,
      miles: 1609.344,
      yd: 0.9144,
      yard: 0.9144,
      yards: 0.9144,
      ft: 0.3048,
      foot: 0.3048,
      feet: 0.3048,
      in: 0.0254,
      inch: 0.0254,
      inches: 0.0254,
      nmi: 1852,
      nauticalmile: 1852
    }
  },
  // Mass / Weight (base: kilograms)
  mass: {
    base: 'kg',
    units: {
      kg: 1,
      kilogram: 1,
      kilograms: 1,
      g: 0.001,
      gram: 0.001,
      grams: 0.001,
      mg: 0.000001,
      milligram: 0.000001,
      milligrams: 0.000001,
      lb: 0.45359237,
      lbs: 0.45359237,
      pound: 0.45359237,
      pounds: 0.45359237,
      oz: 0.028349523,
      ounce: 0.028349523,
      ounces: 0.028349523,
      ton: 1000,
      tonne: 1000,
      tons: 1000,
      stone: 6.35029
    }
  },
  // Speed (base: meters per second)
  speed: {
    base: 'm/s',
    units: {
      'm/s': 1,
      'km/h': 1 / 3.6,
      kmh: 1 / 3.6,
      mph: 0.44704,
      knot: 0.514444,
      knots: 0.514444
    }
  },
  // Area (base: square meters)
  area: {
    base: 'sqm',
    units: {
      sqm: 1,
      'm2': 1,
      'sq m': 1,
      sqkm: 1e6,
      'km2': 1e6,
      'sq km': 1e6,
      sqft: 0.092903,
      'ft2': 0.092903,
      'sq ft': 0.092903,
      acre: 4046.86,
      acres: 4046.86,
      hectare: 10000,
      hectares: 10000,
      sqmi: 2589988.11,
      'sq mi': 2589988.11
    }
  },
  // Volume (base: liters)
  volume: {
    base: 'l',
    units: {
      l: 1,
      liter: 1,
      liters: 1,
      ml: 0.001,
      milliliter: 0.001,
      milliliters: 0.001,
      gal: 3.78541,
      gallon: 3.78541,
      gallons: 3.78541,
      qt: 0.946353,
      quart: 0.946353,
      pt: 0.473176,
      pint: 0.473176,
      cup: 0.236588,
      cups: 0.236588,
      floz: 0.0295735,
      'fl oz': 0.0295735,
      'm3': 1000,
      'cubic meter': 1000
    }
  },
  // Time (base: seconds)
  time: {
    base: 's',
    units: {
      s: 1,
      sec: 1,
      second: 1,
      seconds: 1,
      min: 60,
      minute: 60,
      minutes: 60,
      h: 3600,
      hr: 3600,
      hour: 3600,
      hours: 3600,
      d: 86400,
      day: 86400,
      days: 86400,
      wk: 604800,
      week: 604800,
      weeks: 604800,
      yr: 31536000,
      year: 31536000,
      years: 31536000
    }
  },
  // Digital storage (base: bytes)
  data: {
    base: 'b',
    units: {
      b: 1,
      byte: 1,
      bytes: 1,
      kb: 1024,
      kilobyte: 1024,
      mb: 1024 * 1024,
      megabyte: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      gigabyte: 1024 * 1024 * 1024,
      tb: 1024 * 1024 * 1024 * 1024,
      terabyte: 1024 * 1024 * 1024 * 1024,
      pb: Math.pow(1024, 5)
    }
  },
  // Pressure (base: Pascal)
  pressure: {
    base: 'pa',
    units: {
      pa: 1,
      pascal: 1,
      kpa: 1000,
      bar: 100000,
      psi: 6894.76,
      atm: 101325
    }
  }
};

function normalizeUnit(u) {
  return u.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export async function convertUnits({ value, fromUnit, toUnit }) {
  if (value === undefined || value === null || isNaN(value)) {
    throw new Error('A valid numeric value is required for conversion.');
  }

  const numVal = Number(value);
  const fromClean = normalizeUnit(fromUnit);
  const toClean = normalizeUnit(toUnit);

  // Temperature special case
  const tempAliases = {
    c: 'c', celsius: 'c', centigrade: 'c',
    f: 'f', fahrenheit: 'f',
    k: 'k', kelvin: 'k'
  };

  if (tempAliases[fromClean] && tempAliases[toClean]) {
    const fT = tempAliases[fromClean];
    const tT = tempAliases[toClean];

    let kelvin = 0;
    if (fT === 'c') kelvin = numVal + 273.15;
    else if (fT === 'f') kelvin = (numVal - 32) * (5 / 9) + 273.15;
    else kelvin = numVal;

    let res = 0;
    if (tT === 'c') res = kelvin - 273.15;
    else if (tT === 'f') res = (kelvin - 273.15) * (9 / 5) + 32;
    else res = kelvin;

    const rounded = Math.round(res * 10000) / 10000;
    return {
      value: numVal,
      fromUnit,
      toUnit,
      result: rounded,
      formattedResult: `${rounded} °${tT.toUpperCase()}`,
      category: 'temperature'
    };
  }

  // Search in unit table categories
  for (const [category, catData] of Object.entries(UNIT_TABLE)) {
    let fromFactor = null;
    let toFactor = null;

    for (const [uName, factor] of Object.entries(catData.units)) {
      if (normalizeUnit(uName) === fromClean) fromFactor = factor;
      if (normalizeUnit(uName) === toClean) toFactor = factor;
    }

    if (fromFactor !== null && toFactor !== null) {
      const inBase = numVal * fromFactor;
      const converted = inBase / toFactor;
      const rounded = parseFloat(converted.toPrecision(8));

      return {
        value: numVal,
        fromUnit,
        toUnit,
        result: rounded,
        formattedResult: `${rounded} ${toUnit}`,
        category
      };
    }
  }

  throw new Error(`Cannot convert from '${fromUnit}' to '${toUnit}'. Units must be of the same physical dimension (length, mass, temperature, speed, area, volume, time, data, pressure).`);
}


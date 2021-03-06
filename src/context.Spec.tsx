import { JSDOM } from "jsdom";
import {
  h,
  render as preactRender,
  options,
  Component
} from "preact"; /**@jsx h */
import expect from "expect";
import * as sinon from "sinon";
import { createContext } from "./context";

const Empty = () => null;

describe("context", () => {
  const sandbox = sinon.createSandbox();
  const render = (comp: JSX.Element) =>
    preactRender(comp, scratch, scratch.lastChild as Element);
  let scratch: HTMLDivElement;

  before(() => {
    const anyGlobal = global as any;
    let document = anyGlobal.document;
    if (!document) {
      // we are not running in a browser, create a Jsdom document
      document = anyGlobal.document = new JSDOM(
        `<body></body>`
      ).window.document;
    }
    scratch = document.createElement("div");
    document.body.appendChild(scratch);
  });

  beforeEach(() => {
    options.debounceRendering = (r: any) => r();
  });

  afterEach(() => {
    render(<Empty />);
    sandbox.restore();
  });

  it("exposes a createContext function", () => {
    expect(createContext).toBeDefined();
  });

  describe("createContext", () => {
    it("creates an object with a Provider", () => {
      const ctx = createContext("");
      expect(ctx).toHaveProperty("Provider");
    });

    it("creates an object with a Consumer", () => {
      const ctx = createContext("");
      expect(ctx).toHaveProperty("Consumer");
    });
  });

  describe("Provider", () => {
    it("returns the given children as is", () => {
      const ctx = createContext("");
      render(<ctx.Provider value="a value">Hi from provider</ctx.Provider>);

      expect(scratch.innerHTML).toEqual("Hi from provider");
    });
  });

  describe("Consumer", () => {
    it("returns the given children as is", () => {
      const ctx = createContext("");
      render(
        <ctx.Provider value="init">
          <ctx.Consumer>Hi from consumer</ctx.Consumer>
        </ctx.Provider>
      );

      expect(scratch.innerHTML).toEqual("Hi from consumer");
    });

    it("executes the given children function", () => {
      const ctx = createContext("");
      render(
        <ctx.Provider value="init">
          <ctx.Consumer>{() => "Hi from function"}</ctx.Consumer>
        </ctx.Provider>
      );

      expect(scratch.innerHTML).toEqual("Hi from function");
    });

    it("executes the given render function", () => {
      const ctx = createContext("");
      render(
        <ctx.Provider value="init">
          <ctx.Consumer render={() => "Hi from render"} />
        </ctx.Provider>
      );

      expect(scratch.innerHTML).toEqual("Hi from render");
    });

    it("warns if both a render and children are given", () => {
      const ctx = createContext("");
      const warn = sandbox.stub(console, "warn");
      render(
        <ctx.Provider value="init">
          <ctx.Consumer render={() => "Hi from render"}>
            Hi from children
          </ctx.Consumer>
        </ctx.Provider>
      );

      sinon.assert.calledWith(
        warn,
        "Both children and a render function are defined. Children will be used"
      );
    });

    it("warns if used without a Provide", () => {
      const ctx = createContext("The Default Context");
      const warn = sandbox.stub(console, "warn");
      render(
        <ctx.Consumer>{(value: string) => `Hi from '${value}'`}</ctx.Consumer>
      );

      sinon.assert.calledWith(warn, "Consumer used without a Provider");
    });

    it("has access to the default value if no provider is given", () => {
      const ctx = createContext("The Default Context");
      sandbox.stub(console, "warn");
      render(<ctx.Consumer render={value => `Hi from '${value}'`} />);
      expect(scratch.innerHTML).toEqual("Hi from 'The Default Context'");
    });

    it("has access to the provided value", () => {
      const ctx = createContext("The Default Context");
      render(
        <ctx.Provider value="The Provided Context">
          <ctx.Consumer>{(value: string) => `Hi from '${value}'`}</ctx.Consumer>
        </ctx.Provider>
      );
      expect(scratch.innerHTML).toEqual("Hi from 'The Provided Context'");
    });

    it("updates the value accordingly", () => {
      const ctx = createContext(1);
      const componentDidUpdate = sandbox.spy(
        ctx.Provider.prototype,
        "componentDidUpdate"
      );
      render(
        <ctx.Provider value={2}>
          <ctx.Consumer>{(value: string) => `result: '${value}'`}</ctx.Consumer>
        </ctx.Provider>
      );
      expect(scratch.innerHTML).toEqual("result: '2'");

      // rerender
      render(
        <ctx.Provider value={3}>
          <ctx.Consumer>{(value: string) => `result: '${value}'`}</ctx.Consumer>
        </ctx.Provider>
      );

      expect(scratch.innerHTML).toEqual("result: '3'");
      sinon.assert.calledOnce(componentDidUpdate);
    });

    it("updates the Consumer's value even if indirection is not rendered", () => {
      class Indirection extends Component<any, {}> {
        shouldComponentUpdate() {
          return false;
        }
        render() {
          return this.props.children[0];
        }
      }

      const ctx = createContext("The Default Context");

      render(
        <ctx.Provider value="The Provided Context">
          <Indirection>
            <ctx.Consumer>
              {(value: string) => `Hi from '${value}'`}
            </ctx.Consumer>
          </Indirection>
        </ctx.Provider>
      );
      expect(scratch.innerHTML).toEqual("Hi from 'The Provided Context'");

      // rerender with updated value
      render(
        <ctx.Provider value="The Updated Context">
          <Indirection>
            <ctx.Consumer>
              {(value: string) => `Hi from '${value}'`}
            </ctx.Consumer>
          </Indirection>
        </ctx.Provider>
      );

      expect(scratch.innerHTML).toEqual("Hi from 'The Updated Context'");
    });
  });

  describe("nested contextes", () => {
    it("Provider passes the updated value to the sub consumer", () => {
      const ctx = createContext(10);

      render(
        <ctx.Provider value={12}>
          <ctx.Consumer>
            {(value: number) => (
              <div>
                <span className="result">{value}</span>
                <ctx.Provider value={value * 10}>
                  <ctx.Consumer>
                    {(value: number) => (
                      <span className="nested-result">{value}</span>
                    )}
                  </ctx.Consumer>
                </ctx.Provider>
              </div>
            )}
          </ctx.Consumer>
        </ctx.Provider>
      );

      const result = document.querySelector(".result");
      expect(result).not.toBeNull();
      expect(result!.innerHTML).toEqual("12");

      const nested = document.querySelector(".nested-result");
      expect(nested).not.toBeNull();
      expect(nested!.innerHTML).toEqual("120");
    });

    it("each context can consume other contextes", () => {
      const numContext = createContext(10);
      const textContext = createContext("hi");

      render(
        <numContext.Provider value={12}>
          <numContext.Consumer>
            {(num: number) => (
              <div>
                <span className="result">{num}</span>
                <textContext.Provider value={`consumed num: ${num}`}>
                  <div>
                    <span className="nested-number">{num}</span>
                    <textContext.Consumer>
                      {(text: string) => (
                        <span className="nested-result">{text}</span>
                      )}
                    </textContext.Consumer>
                  </div>
                </textContext.Provider>
              </div>
            )}
          </numContext.Consumer>
        </numContext.Provider>
      );

      const result = document.querySelector(".result");
      expect(result).not.toBeNull();
      expect(result!.innerHTML).toEqual("12");

      const num = document.querySelector(".nested-number");
      expect(num).not.toBeNull();
      expect(num!.innerHTML).toEqual("12");

      const nested = document.querySelector(".nested-result");
      expect(nested).not.toBeNull();
      expect(nested!.innerHTML).toEqual("consumed num: 12");
    });

    it("each context provides the value to it's consumer", () => {
      const numContext = createContext(10);
      const textContext = createContext("hi");
      sandbox.stub(console, "warn");

      render(
        <numContext.Provider value={12}>
          <numContext.Consumer>
            {(value: number) => (
              <div>
                <span className="result">{value}</span>
                <numContext.Consumer>
                  {(value: number) => (
                    <span className="number-result">{value}</span>
                  )}
                </numContext.Consumer>
                <textContext.Consumer>
                  {(value: string) => (
                    <span className="text-result">{value}</span>
                  )}
                </textContext.Consumer>
              </div>
            )}
          </numContext.Consumer>
        </numContext.Provider>
      );

      const result = document.querySelector(".result");
      expect(result).not.toBeNull();
      expect(result!.innerHTML).toEqual("12");

      const number = document.querySelector(".number-result");
      expect(number).not.toBeNull();
      expect(number!.innerHTML).toEqual("12");

      const text = document.querySelector(".text-result");
      expect(text).not.toBeNull();
      expect(text!.innerHTML).toEqual("hi");
    });
  });
});

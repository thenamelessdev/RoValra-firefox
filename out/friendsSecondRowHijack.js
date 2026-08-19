/*!
 * rovalra v2.6.6
 * License: GPL-3.0
 * Repository: https://github.com/NotValra/RoValra
 * This extension is provided AS-IS without warranty.
 */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: !0 });
(function() {
  "use strict";
  if (window.__ROVALRA_REACT_HOOK_SETUP__) return;
  window.__ROVALRA_REACT_HOOK_SETUP__ = !0;
  let friendsSecondRowEnabled = !1;
  document.addEventListener("rovalra-friends-second-row", (event) => {
    friendsSecondRowEnabled = event.detail?.enabled === !0;
  });
  const onSet = /* @__PURE__ */ __name((obj, prop, callback) => {
    if (obj[prop]) return callback(obj[prop]);
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(obj, prop);
    } catch {
    }
    Object.defineProperty(obj, prop, {
      enumerable: !1,
      configurable: !0,
      set(value) {
        delete obj[prop];
        try {
          Object.defineProperty(obj, prop, descriptor);
        } catch {
        }
        obj[prop] = value, callback(value);
      }
    });
  }, "onSet"), reactHook = {
    constructorProxies: /* @__PURE__ */ new WeakMap(),
    constructorReplaces: [],
    renderTarget: null,
    hijackConstructor(filter, handler) {
      const info = {
        filter,
        handler,
        remove() {
          this.removed = !0;
        }
      };
      return this.constructorReplaces.push(info), info;
    },
    hijackUseState(filter, transform) {
      const renderTarget = this.renderTarget;
      if (!renderTarget)
        throw new TypeError("RoValra: Not in a render method.");
      renderTarget.hijackState || (renderTarget.hijackState = []), renderTarget.hijackState.push({ filter, transform });
    },
    nextConstructorReplace(render, index, thisArg, args) {
      for (; index < reactHook.constructorReplaces.length; index++) {
        const info = reactHook.constructorReplaces[index];
        if (info.removed) {
          reactHook.constructorReplaces.splice(index--, 1);
          continue;
        }
        if (info.filter(args[0]))
          return info.handler(
            function(...innerArgs) {
              return reactHook.nextConstructorReplace(
                render,
                index + 1,
                this,
                innerArgs
              );
            },
            thisArg,
            args
          );
      }
      return render.apply(thisArg, args);
    },
    renderProxyProps: {
      apply(render, thisArg, args) {
        return reactHook.renderTarget ? reactHook.nextConstructorReplace(
          render,
          0,
          thisArg,
          args
        ) : render.apply(thisArg, args);
      }
    },
    applyProxy(fiber) {
      const type = fiber.type;
      if (!type) return;
      let target, key, render;
      if (typeof type == "function" ? type.prototype?.isReactComponent ? (target = type.prototype, key = "render", render = type.prototype.render) : (target = fiber, key = "type", render = type) : typeof type == "object" && (typeof type.render == "function" ? (target = type, key = "render", render = type.render) : typeof type.type == "function" && (target = type, key = "type", render = type.type)), typeof render == "function" && !this.constructorProxies.get(render)) {
        const proxy = new Proxy(render, this.renderProxyProps);
        this.constructorProxies.set(proxy, !0), target[key] = proxy;
      }
    },
    onUseState(target, thisArg, args) {
      const renderTarget = this.renderTarget;
      if (!renderTarget) return target.apply(thisArg, args);
      const matching = [];
      if (renderTarget.hijackState)
        for (const filter of renderTarget.hijackState)
          !filter.resolved && filter.filter(args[0]) && (filter.resolved = !0, filter.transform && (args[0] = filter.transform(args[0], !0)), matching.push(filter));
      const result = target.apply(thisArg, args);
      for (const filter of matching)
        filter.transform && (result[1] = new Proxy(result[1], {
          apply(setState, setStateThis, setStateArgs) {
            return setStateArgs[0] = filter.transform(
              setStateArgs[0],
              !1
            ), setState.apply(setStateThis, setStateArgs);
          }
        }));
      return result;
    },
    onReact(_react) {
      this.React = _react;
      const original = this.React.useState;
      this.React.useState = new Proxy(original, {
        apply: this.onUseState.bind(this)
      });
      const dispatcher = this.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher;
      let current = dispatcher.current;
      Object.defineProperty(Object.prototype, "lanes", {
        configurable: !0,
        get() {
        },
        set(value) {
          if (Object.defineProperty(this, "lanes", {
            enumerable: !0,
            configurable: !0,
            writable: !0,
            value
          }), "tag" in this && "pendingProps" in this && !this.rovalraAttached) {
            this.rovalraAttached = !0;
            let type = this.type;
            const fiber = this;
            try {
              reactHook.applyProxy(fiber);
            } catch (e) {
              console.error("[RoValra]:", e);
            }
            Object.defineProperty(fiber, "type", {
              configurable: !0,
              get() {
                return type;
              },
              set(newType) {
                type = newType;
                try {
                  reactHook.applyProxy(fiber);
                } catch (e) {
                  console.error("RoValra:", e);
                }
              }
            });
          }
        }
      }), Object.defineProperty(dispatcher, "current", {
        enumerable: !0,
        get() {
          return current;
        },
        set(value) {
          current = value, current && current.useCallback !== current.useEffect ? reactHook.renderTarget = { state: [] } : reactHook.renderTarget = null;
        }
      });
    },
    init() {
      onSet(window, "React", this.onReact.bind(this));
    }
  };
  reactHook.init(), reactHook.hijackConstructor(
    (props) => props && "friendsList" in props,
    (target, thisArg, args) => {
      const props = args[0], friendsList = props.friendsList, carouselName = props.carouselName, showSecondRow = friendsSecondRowEnabled && carouselName === "WebHomeFriendsCarousel";
      showSecondRow && reactHook.hijackUseState(
        (value) => value === friendsList,
        (value, initial) => value && friendsList && !initial ? friendsList.slice(0, value.length * 2 + 1) : value
      );
      const result = target.apply(thisArg, args);
      if (showSecondRow)
        try {
          result.props.className = `${result.props.className ?? ""} rovalra-friends-second-row-native`.trim();
        } catch {
        }
      return result;
    }
  ), console.log("[RoValra] Friends second row (native) hook loaded.");
})();

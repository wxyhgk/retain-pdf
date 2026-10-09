/** mount 返回的实例：可以自带 update / unmount，也可以什么都不带。 */
export type ComponentInstance = {
  update?: (props: unknown, context?: unknown) => void;
  unmount?: (context?: unknown) => void;
  [key: string]: unknown;
};

export type ComponentDefinition<TProps = Record<string, unknown>, TContext = Record<string, unknown>> = {
  name?: string;
  mount: (props: TProps, context: TContext) => ComponentInstance | void;
  update?: ((instance: ComponentInstance, props: TProps, context: TContext) => void) | null;
  unmount?: ((instance: ComponentInstance, context: TContext) => void) | null;
};

export function defineComponent<TProps = Record<string, unknown>, TContext = Record<string, unknown>>({
  name,
  mount,
  update = null,
  unmount = null,
}: ComponentDefinition<TProps, TContext>) {
  const componentName = `${name || ""}`.trim();
  if (!componentName) {
    throw new TypeError("Component requires a name.");
  }
  if (typeof mount !== "function") {
    throw new TypeError(`Component "${componentName}" requires a mount function.`);
  }
  return Object.freeze({
    name: componentName,
    mount,
    update,
    unmount,
  });
}

export function mountComponent<TProps, TContext>(
  component: ReturnType<typeof defineComponent<TProps, TContext>>,
  props: TProps = {} as TProps,
  context: TContext = {} as TContext,
) {
  if (!component || typeof component.mount !== "function") {
    throw new TypeError("mountComponent requires a component created by defineComponent.");
  }
  let mounted = true;
  const instance: ComponentInstance = component.mount(props, context) || {};

  return Object.freeze({
    name: component.name,
    update(nextProps = props) {
      if (!mounted) {
        return;
      }
      if (typeof instance.update === "function") {
        instance.update(nextProps, context);
        return;
      }
      if (typeof component.update === "function") {
        component.update(instance, nextProps, context);
      }
    },
    unmount() {
      if (!mounted) {
        return;
      }
      mounted = false;
      if (typeof instance.unmount === "function") {
        instance.unmount(context);
        return;
      }
      if (typeof component.unmount === "function") {
        component.unmount(instance, context);
      }
    },
  });
}

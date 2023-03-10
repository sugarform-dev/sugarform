import type { Sugar, SugarObjectNode, SugarUser, SugarUserReshaper, SugarValue } from '.';
import { SugarFormError } from '../../util/error';
import { SugarDownstreamEventEmitter } from '../../util/events/downstreamEvent';
import { SugarUpstreamEventEmitter } from '../../util/events/upstreamEvent';
import type { SugarObject } from '../../util/object';
import { isSugarObject } from '../../util/object';
import { useSugar } from './use';
import { useSugarFromRef } from './useFromRef';

export function createEmptySugar<T>(path: string, template: T): Sugar<T> {
  const sugar: Sugar<T> = {
    path,
    mounted: false,
    template,
    upstream: new SugarUpstreamEventEmitter(),
    downstream: new SugarDownstreamEventEmitter(),
    use:
      <U extends SugarObject>(options: SugarUserReshaper<T, U>) => useSugar<T, U>(sugar, options),
    useFromRef:
      (param: { get: () => SugarValue<T>, set: (value: T) => void }) =>
        useSugarFromRef(sugar, param),
    useObject: (
      isSugarObject(template) ?
        (options: SugarUser<SugarObject> = {}): SugarObjectNode<SugarObject> =>
          useSugar<SugarObject, SugarObject>(
          sugar as Sugar<SugarObject>,
          {
            ...options,
            reshape: {
              transform: x => x,
              deform: x => x,
            },
          } as SugarUserReshaper<SugarObject, SugarObject>,
          )
        : neverFunction(path, 'useObject')
    ) as T extends SugarObject ? (options?: SugarUser<T>) => SugarObjectNode<T> : never,
  };

  return sugar;
}

export function neverFunction(path: string, name: string): never {
  const error: never =  ((): void => {
    throw new SugarFormError('SF0002', `This function should not be called. at ${path} of ${name}`);
  }) as unknown as never;

  return error;
}

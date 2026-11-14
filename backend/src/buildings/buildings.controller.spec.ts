import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { BuildingsController } from './buildings.controller';

describe('BuildingsController action status', () => {
  it('returns 200 for deactivate and reactivate without changing create', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, BuildingsController.prototype.deactivate)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, BuildingsController.prototype.deactivate)).toBe(
      ':id/deactivate',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, BuildingsController.prototype.deactivate)).toBe(
      HttpStatus.OK,
    );

    expect(Reflect.getMetadata(METHOD_METADATA, BuildingsController.prototype.reactivate)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, BuildingsController.prototype.reactivate)).toBe(
      ':id/reactivate',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, BuildingsController.prototype.reactivate)).toBe(
      HttpStatus.OK,
    );

    expect(Reflect.getMetadata(METHOD_METADATA, BuildingsController.prototype.create)).toBe(
      RequestMethod.POST,
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, BuildingsController.prototype.create),
    ).toBeUndefined();
  });
});

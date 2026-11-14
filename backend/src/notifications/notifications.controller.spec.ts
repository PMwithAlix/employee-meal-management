import { HttpStatus, RequestMethod } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController action status', () => {
  it('returns 200 for mark-read and read-all instead of the POST default 201', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, NotificationsController.prototype.markRead)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.markRead)).toBe(
      ':id/read',
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, NotificationsController.prototype.markRead)).toBe(
      HttpStatus.OK,
    );

    expect(Reflect.getMetadata(METHOD_METADATA, NotificationsController.prototype.markAllRead)).toBe(
      RequestMethod.POST,
    );
    expect(Reflect.getMetadata(PATH_METADATA, NotificationsController.prototype.markAllRead)).toBe(
      'read-all',
    );
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, NotificationsController.prototype.markAllRead),
    ).toBe(HttpStatus.OK);
  });
});

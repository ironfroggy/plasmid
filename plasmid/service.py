import argparse
import json
import logging
import sys
import time
from os.path import abspath, join, dirname

from zope.interface import implements

from twisted.internet import reactor
from twisted.web.server import Site
from twisted.web.resource import Resource, IResource
from twisted.web.static import File
from twisted.cred.portal import IRealm, Portal
from twisted.cred import error

from plasmid.util import endpoint, StringResource
from plasmid.storage import Hub, Storage
from plasmid.cred import APIAuthSessionWrapper, PlasmidCredChecker, PlasmidRealm
from plasmid.cred import CredentialBackend


static_path = abspath(join(dirname(__file__), '..', 'static'))


class ServiceRoot(Resource):

    def __init__(self, portal, hub):
        Resource.__init__(self)
        self.portal = portal
        self.hub = hub
        logging.info("Service ready at '%s'" % (hub.path))

    def getChild(self, name, request):
        if name == 'static':
            return File(static_path)
        elif name == 'api':
            return APIAuthSessionWrapper(self.portal, [PlasmidCredChecker(self.hub)])
        else:
            "nothing here"


class Plasmid(Resource):

    def __init__(self, hub, avatarId):
        Resource.__init__(self)
        self.hub = hub
        self.databases = {}
        self.avatarId = avatarId

    def getChild(self, name, request):
        if name:
            try:
                return self.databases[name]
            except KeyError:
                if CredentialBackend(self.hub).get_permission(self.avatarId, 'CreateDatabase', name):
                    s = Storage(self.hub, name)
                    self.databases[name] = db = Database(self.hub, self.avatarId, name, s)
                    return db
                else:
                    raise error.UnauthorizedLogin()
        else:
            return StringResource(json.dumps({
                "databases": self.databases.keys(),
            }))


class Database(Resource):

    def __init__(self, hub, access, name, storage):
        Resource.__init__(self)
        self.hub = hub
        self.access = access
        self.name = name
        self.storage = storage
        if CredentialBackend(hub).get_permission(self.access, 'ReadDatabase', self.name):
            self.can_read = True
        else:
            self.can_read = False

    def info(self, msg):
        logging.info("%s/%s %s" % (self.name, self.access[1], msg))

    @property
    def revision(self):
        if self.can_read:
            return self.storage.get_meta('revision')

    @endpoint
    def render_GET(self, request):
        if self.can_read:
            return {
                "name": self.name,
                "revision": self.revision,
            }

    def getChild(self, name, request):
        return DatabaseMethod(self, name)

    @endpoint
    def get_clone(self, request):
        if self.can_read:
            data = self.storage.get_data()
            return {
                "data": data,
                "revision": self.revision,
            }

    @endpoint
    def get_update(self, request, last_revision):
        if self.can_read:
            last_revision = int(last_revision)
            updates = []
            data = self.storage.get_data(revision=last_revision)
            for store in data:
                for k, (i, v) in data[store].items():
                    updates.append((store, i, k, v))
            print 'PULL', updates
            self.info("Client pulled %d updates." % (len(updates)))
            return {
                "since": last_revision,
                "until": self.revision,
                "updates": updates,
            }

    @endpoint
    def post_update(self, request, x):
        if CredentialBackend(self.hub).get_permission(self.access, 'WriteDatabase', self.name):
            body = json.load(request.content)
            last_revision = body['last_revision']
            data = body['data']

            if self.revision > last_revision:
                self.info("Client tried to push from out of date clone.")
                return {
                    'error': "Cannot update. Master has changed. %s > %s" % (self.revision, last_revision),
                    'saved': 0,
                    'reason': 'outofdate',
                }

            else:
                self.storage.set_data(data)
                self.info("Client sent %s updates." % (len(data),))
                return {
                    'saved': len(data),
                    'revision': self.storage.get_meta('revision'),
                }


class DatabaseMethod(Resource):

    def __init__(self, database, name, args=None):
        Resource.__init__(self)
        self.database = database
        self.name = name
        self.args = args or []

    def getChild(self, name, request):
        return DatabaseMethod(self.database, self.name, self.args + [name])

    def render_GET(self, request):
        method = getattr(self.database, 'get_' + self.name)
        return method(request, *self.args)

    def render_POST(self, request):
        method = getattr(self.database, 'post_' + self.name)
        return method(request, *self.args)
# configuration

hub = None
port = 8880

guest_db_prefix = 'guest_'
guest_db_qouta = 1024 * 1024


def configure(**params):
	for key in params:
		globals()[key] = params[key]

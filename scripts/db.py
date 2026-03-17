"""Supabase REST API 직접 호출"""
import requests

SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

class Table:
    def __init__(self, name):
        self.name = name
        self.url = f"{SUPABASE_URL}/rest/v1/{name}"

    def select(self, columns="*"):
        return Query(self.url, self.name, "select", columns)

    def insert(self, data):
        return InsertQuery(self.url, data)

class InsertQuery:
    def __init__(self, url, data):
        self.url = url
        self.data = data

    def execute(self):
        resp = requests.post(self.url, json=self.data, headers=HEADERS)
        if not resp.ok:
            raise Exception(f"Insert failed ({resp.status_code}): {resp.text[:200]}")
        return type("R", (), {"data": resp.json() if resp.text else []})()

class Query:
    def __init__(self, url, table, op, columns):
        self.url = url
        self.params = {"select": columns}

    def eq(self, col, val):
        self.params[col] = f"eq.{val}"
        return self

    def execute(self):
        resp = requests.get(self.url, params=self.params, headers=HEADERS)
        return type("R", (), {"data": resp.json() if resp.ok else []})()

class DB:
    def table(self, name):
        return Table(name)

supabase = DB()

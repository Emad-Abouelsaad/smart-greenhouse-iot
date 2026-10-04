# Python simulator

Virtual ESP8266 node and greenhouse model. See [docs/setup.md](../docs/setup.md#6-python-simulator-optional).

```bash
pip install -r requirements.txt
python esp8266_simulator.py --offline --steps 20 --scenario hotDay --csv run.csv
pytest -q
```

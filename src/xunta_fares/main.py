# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "openpyxl",
#     "pandas",
#     "requests",
# ]
# ///

from io import BytesIO
import logging
import pandas as pd
import requests

def download_municipality_list() -> None:
    resp = requests.get('https://www.ine.es/daco/daco42/codmun/diccionario25.xlsx')
    if resp.status_code != 200:
        raise Exception(f"Failed to download file: {resp.status_code}")
    content_bytes = BytesIO(resp.content)
    return pd.read_excel(content_bytes, skiprows=1)


def download_fare_data() -> None:
    resp = requests.get('https://www.bus.gal/sites/w_tpgal/files/faq/2026/01/202601._calculadora_tarifas_ptpg_2026_descuentos_cas.xlsx')
    if resp.status_code != 200:
        raise Exception(f"Failed to download file: {resp.status_code}")
    content_bytes = BytesIO(resp.content)
    return pd.read_excel(content_bytes, sheet_name='PTPG_Tarifas_2026')


GALICIA_CCAA = '12'

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logging.info("Downloading municipality list...")
    municipalities_df = download_municipality_list()
    municipalities_df.columns = ['ccaa', 'prov', 'muni', 'dc', 'nombre']

    municipalities_df = municipalities_df[municipalities_df['ccaa'].astype(str) == GALICIA_CCAA]
    municipalities_df['code'] = municipalities_df['prov'].astype(str).str.zfill(2) + municipalities_df['muni'].astype(str).str.zfill(3)
    municipalities_df = municipalities_df[['nombre', 'code']].reset_index(drop=True)

    fare_data_df = download_fare_data()
    fare_data_df.columns = [
        'conc_inicio', 'conc_fin', 'rel', 'bonificacion',
        'efectivo',
        'tmg_ignorar', 'tmgrecurr_ignorar',
        'tpg', 'tpgrecurr']

    fare_data_df = fare_data_df[['conc_inicio', 'conc_fin', 'bonificacion', 'efectivo', 'tpg']]

    # Rename municipalities in fare file, where leading article should be at the end
    # 'A Arnoia' should be 'Arnoia, A' and 'O Pino' should be 'Pino, O'
    fare_data_df['conc_inicio'] = fare_data_df['conc_inicio'].apply(lambda x: f"{x[2:]}, {x[0:1]}" if x.startswith('A ') or x.startswith('O ') else x)
    fare_data_df['conc_inicio'] = fare_data_df['conc_inicio'].apply(lambda x: f"{x[3:]}, {x[0:2]}" if x.startswith('As ') or x.startswith('Os ') else x)
    fare_data_df['conc_fin'] = fare_data_df['conc_fin'].apply(lambda x: f"{x[2:]}, {x[0:1]}" if x.startswith('A ') or x.startswith('O ') else x)
    fare_data_df['conc_fin'] = fare_data_df['conc_fin'].apply(lambda x: f"{x[3:]}, {x[0:2]}" if x.startswith('As ') or x.startswith('Os ') else x)

    # conc_inicio and conc_fin are municipality names, we need to map them to codes
    fare_data_df = fare_data_df.merge(
        municipalities_df, left_on='conc_inicio', right_on='nombre', how='left')
    fare_data_df = fare_data_df.rename(columns={'code': 'conc_inicio_code'})
    fare_data_df = fare_data_df.drop(columns=['nombre'])

    fare_data_df = fare_data_df.merge(
        municipalities_df, left_on='conc_fin', right_on='nombre', how='left')
    fare_data_df = fare_data_df.rename(columns={'code': 'conc_fin_code'})
    fare_data_df = fare_data_df.drop(columns=['nombre'])

    # Check for missing municipality codes
    missing_inicio = fare_data_df[fare_data_df['conc_inicio_code'].isna()]['conc_inicio'].unique()
    missing_fin = fare_data_df[fare_data_df['conc_fin_code'].isna()]['conc_fin'].unique()

    if len(missing_inicio) > 0 or len(missing_fin) > 0:
        all_missing = set(missing_inicio) | set(missing_fin)
        logging.warning(f"Could not find codes for the following municipalities: {all_missing}")

    # Bonificación '-' -> null
    fare_data_df['bonificacion'] = fare_data_df['bonificacion'].replace('-', pd.NA)

    # Drop conc_inicio and conc_fin columns
    fare_data_df = fare_data_df.drop(columns=['conc_inicio', 'conc_fin'])

    # Move conc_inicio_code and conc_fin_code to the front and rename for clarity
    fare_data_df = fare_data_df[['conc_inicio_code', 'conc_fin_code', 'bonificacion', 'efectivo', 'tpg']]
    fare_data_df = fare_data_df.rename(columns={
        'conc_inicio_code': 'conc_inicio',
        'conc_fin_code': 'conc_fin'
    })

    # Make decimals have two decimal places (since it's currency, and to avoid floating point issues)
    fare_data_df['efectivo'] = fare_data_df['efectivo'].round(2)
    fare_data_df['tpg'] = fare_data_df['tpg'].round(2)

    fare_data_df.to_csv('xunta_fares.csv', index=False)

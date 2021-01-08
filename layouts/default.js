import { Component } from 'React'
import PropTypes from 'prop-types';
import styles from '../styles/Home.module.css'

export default class Home extends Component {
  constructor(props){
    super(props)
  }

  state = {}

  render() {
    const { children } = this.props;
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          {children}
        </main>

        <footer className={styles.footer}>
          <a
            href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Powered by{' '}
            <img src="/vercel.svg" alt="Vercel Logo" className={styles.logo} />
          </a>
        </footer>
      </div>
    )
  }
  static propTypes = {
    children: PropTypes.any
  }
}

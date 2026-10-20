import { Component } from 'react'
import type { ReactNode } from 'react'
export default class RouteLoadBoundary extends Component<{children:ReactNode; path:string},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError() { return {failed:true} }
  componentDidUpdate(previous:{path:string}) { if(previous.path!==this.props.path && this.state.failed)this.setState({failed:false}) }
  render() {
    if(!this.state.failed)return this.props.children
    return <section className="page module-page module-empty" role="alert"><h1>这个页面暂时没有加载成功</h1><p>网络可能中断，或网站刚刚更新。网络恢复后，重新加载当前页即可再试；尚未提交的填写内容可能需要重新输入。</p><button className="button-link" type="button" onClick={()=>window.location.reload()}>重新加载当前页</button><a className="text-link" href="/">返回首页</a></section>
  }
}
